import 'dart:io';
import 'dart:convert';
import 'package:args/args.dart';
import 'package:logging/logging.dart';
import 'package:path/path.dart' as p;

final log = Logger('SupaLocalizationManager');

Future<void> main(List<String> arguments) async {
  Logger.root.level = Level.ALL; // defaults to Level.INFO
  Logger.root.onRecord.listen((record) {
    print('${record.level.name}: ${record.time}: ${record.message}');
  });

  final parser = ArgParser();

  // Register commands.
  parser.addCommand('merge');
  parser.addCommand('reorder');
  final extractCommand = parser.addCommand('extract');
  extractCommand.addOption(
    'locale',
    abbr: 'l',
    defaultsTo: 'en',
    help: 'Locale to check',
  );
  extractCommand.addOption(
    'source',
    abbr: 's',
    defaultsTo: 'lib',
    help: 'Source directory to scan for Dart files',
  );
  extractCommand.addFlag(
    'remove-orphans',
    abbr: 'r',
    defaultsTo: false,
    help: 'Remove keys that are not found in the code',
  );
  extractCommand.addFlag(
    'reorder',
    abbr: 'o',
    defaultsTo: false,
    help: 'Reorder keys alphabetically in result files',
  );

  final generateCommand = parser.addCommand('generate');
  generateCommand.addOption(
    'input-dir',
    abbr: 'i',
    defaultsTo: 'assets/i18n',
    help: 'Input directory for JSON files',
  );
  generateCommand.addOption(
    'output-file',
    abbr: 'o',
    defaultsTo: 'lib/generated/l10n.dart',
    help: 'Output file for generated Dart code',
  );

  if (arguments.isEmpty) {
    log.info('Usage: supa_l10n_manager <command> [options]');
    log.info('Commands: merge, extract, reorder, generate');
    exit(1);
  }

  final argResults = parser.parse(arguments);
  final command = argResults.command;
  if (command == null) {
    log.warning('No command provided.');
    exit(1);
  }

  switch (command.name) {
    case 'merge':
      await mergeTranslations();
      break;
    case 'extract':
      final locale = command['locale'];
      final sourceDir = command['source'];
      final removeOrphans = command['remove-orphans'];
      final reorder = command['reorder'];
      await extractMissingKeys(locale, sourceDir, removeOrphans, reorder);
      break;
    case 'reorder':
      await reorderTranslationKeys();
      break;
    case 'generate':
      final inputDir = command['input-dir'];
      final outputFile = command['output-file'];
      await generateDartCode(inputDir, outputFile);
      break;
    default:
      log.warning('Unknown command: ${command.name}');
      exit(1);
  }
}

Future<void> generateDartCode(String inputDir, String outputFile) async {
  final assetsDir = Directory(inputDir);
  if (!assetsDir.existsSync()) {
    log.warning('Directory $inputDir not found.');
    exit(1);
  }

  final localeFiles = assetsDir
      .listSync()
      .whereType<File>()
      .where((file) => file.path.endsWith('.json'));

  final allTranslations = <String, Map<String, dynamic>>{};

  for (var file in localeFiles) {
    final locale = p.basenameWithoutExtension(file.path);
    try {
      final content = file.readAsStringSync();
      final Map<String, dynamic> jsonMap = json.decode(content);
      allTranslations[locale] = jsonMap;
    } catch (e) {
      log.severe('Error reading ${file.path}: $e');
    }
  }

  final output = StringBuffer();
  output.writeln('// GENERATED FILE, DO NOT EDIT');
  output.writeln('// ignore_for_file: constant_identifier_names');
  output.writeln('');
  output.writeln('const Map<String, Map<String, dynamic>> supaTranslations = {');

  allTranslations.forEach((locale, translations) {
    output.writeln("  '$locale': {");
    translations.forEach((key, value) {
      final encodedValue = json.encode(value);
      output.writeln("    '$key': $encodedValue,");
    });
    output.writeln('  },');
  });

  output.writeln('};');

  final outFile = File(outputFile);
  if (!outFile.parent.existsSync()) {
    outFile.parent.createSync(recursive: true);
  }
  outFile.writeAsStringSync(output.toString());
  log.info('Generated Dart code in $outputFile');
}

/// Merges JSON files found in each locale subdirectory (e.g., assets/i18n/en/)
/// into a single file (e.g., assets/i18n/en.json).
Future<void> mergeTranslations() async {
  final assetsDir = Directory('assets/i18n');
  if (!assetsDir.existsSync()) {
    log.warning('Directory assets/i18n not found.');
    exit(1);
  }
  final List<Directory> localeDirs =
      assetsDir.listSync().whereType<Directory>().toList();

  for (var localeDir in localeDirs) {
    final locale = localeDir.path.split(Platform.pathSeparator).last;
    final mergedMap = <String, dynamic>{};

    // Process each JSON file in the locale subdirectory.
    final jsonFiles = localeDir
        .listSync()
        .whereType<File>()
        .where((file) => file.path.endsWith('.json'));

    for (var file in jsonFiles) {
      final filename = file.uri.pathSegments.last;
      final namespace = filename.replaceAll('.json', '');
      try {
        final content = file.readAsStringSync();
        final Map<String, dynamic> jsonMap = json.decode(content);
        jsonMap.forEach((key, value) {
          // In the merged file, keys are prefixed by the namespace.
          final fullKey = '$namespace.$key';
          mergedMap[fullKey] = value;
        });
      } catch (e) {
        log.severe('Error reading ${file.path}: $e');
      }
    }
    final mergedFile = File('assets/i18n/$locale.json');
    mergedFile
        .writeAsStringSync(JsonEncoder.withIndent('  ').convert(mergedMap));
    log.info(
        'Merged translations for locale "$locale" into ${mergedFile.path}');
  }
}

/// Scans Dart source files for `translate('...')` usages and updates
/// individual namespace JSON files under assets/i18n/{locale}/.
/// If a namespace file doesn't exist, it will be created. Any missing key is
/// added with an empty string value. Optionally removes orphan keys and reorders the result.
Future<void> extractMissingKeys(
    String locale, String sourceDir, bool removeOrphans, bool reorder) async {
  // Recursively search for Dart files.
  final dir = Directory(sourceDir);
  if (!dir.existsSync()) {
    log.severe('Source directory "$sourceDir" not found.');
    exit(1);
  }

  final Set<String> keysFound = {};
  // Regex pattern to capture translate('key') usages.
  final regex = RegExp(
      r"translate\s*\(\s*'([A-Za-z0-9$\{\}\.]+)'\s*(?:,\s*\{[^}]*\})?\s*\)");

  await for (var entity in dir.list(recursive: true, followLinks: false)) {
    if (entity is File && entity.path.endsWith('.dart')) {
      final content = await entity.readAsString();
      for (final match in regex.allMatches(content)) {
        final key = match.group(1);
        if (key != null) {
          keysFound.add(key);
        }
      }
    }
  }

  // Group keys by namespace (the part before the first dot).
  final Map<String, Set<String>> keysByNamespace = {};
  for (final fullKey in keysFound) {
    final parts = fullKey.split('.');
    if (parts.length < 2) {
      log.info('Skipping key without namespace: $fullKey');
      continue;
    }
    final namespace = parts.first;
    // Store the remainder of the key (everything after the namespace).
    final keyPart = parts.sublist(1).join('.');
    keysByNamespace.putIfAbsent(namespace, () => <String>{});
    keysByNamespace[namespace]!.add(keyPart);
  }

  // Ensure the locale directory exists: assets/i18n/<locale>/
  final localeDir = Directory('assets/i18n/$locale');
  if (!localeDir.existsSync()) {
    log.severe(
        'Locale directory "assets/i18n/$locale" does not exist. Creating...');
    localeDir.createSync(recursive: true);
  }

  // Process each namespace group.
  for (final entry in keysByNamespace.entries) {
    final namespace = entry.key;
    final keys = entry.value.toList()..sort((a, b) => a.compareTo(b));

    final filePath = 'assets/i18n/$locale/$namespace.json';
    final jsonFile = File(filePath);
    Map<String, dynamic> jsonMap = {};

    if (jsonFile.existsSync()) {
      try {
        final content = jsonFile.readAsStringSync();
        if (content.trim().isNotEmpty) {
          jsonMap = json.decode(content);
        }
      } catch (e) {
        log.severe('Error reading $filePath: $e');
        continue;
      }
    } else {
      log.severe('File $filePath does not exist. Creating...');
    }

    bool updated = false;

    // Handle orphan keys removal if enabled
    if (removeOrphans) {
      final orphanKeys =
          jsonMap.keys.where((key) => !keys.contains(key)).toList();
      for (final orphanKey in orphanKeys) {
        jsonMap.remove(orphanKey);
        updated = true;
        log.fine('Removed orphan key "$namespace.$orphanKey".');
      }
    }

    // Add each missing key with an empty value.
    for (final key in keys) {
      if (!jsonMap.containsKey(key)) {
        jsonMap[key] = "";
        updated = true;
        log.fine('Added missing key "$namespace.$key" with empty value.');
      }
    }

    // Sort keys if reordering is enabled
    if (reorder && jsonMap.isNotEmpty) {
      final sortedMap = Map.fromEntries(
          jsonMap.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
      jsonMap = sortedMap;
      updated = true;
      log.fine('Reordered keys in "$filePath".');
    }

    if (updated) {
      jsonFile.writeAsStringSync(JsonEncoder.withIndent('  ').convert(jsonMap));
      log.info('Updated file: $filePath');
    } else {
      log.info('No changes needed in $filePath.');
    }
  }
}

/// Scans all JSON files in assets/i18n directory and reorders their keys alphabetically.
/// This works with both flattened locale JSON files (like en.json) and individual
/// namespace files in locale subdirectories.
Future<void> reorderTranslationKeys() async {
  final assetsDir = Directory('assets/i18n');
  if (!assetsDir.existsSync()) {
    log.warning('Directory assets/i18n not found.');
    exit(1);
  }

  int processedFiles = 0;

  // Process all JSON files directly in assets/i18n (merged locale files)
  final rootFiles = assetsDir
      .listSync()
      .whereType<File>()
      .where((file) => file.path.endsWith('.json'));

  for (var file in rootFiles) {
    await _reorderKeysInFile(file);
    processedFiles++;
  }

  // Process all JSON files in locale subdirectories
  final localeDirs = assetsDir.listSync().whereType<Directory>().toList();

  for (var localeDir in localeDirs) {
    final jsonFiles = localeDir
        .listSync()
        .whereType<File>()
        .where((file) => file.path.endsWith('.json'));

    for (var file in jsonFiles) {
      await _reorderKeysInFile(file);
      processedFiles++;
    }
  }

  log.info('Successfully reordered keys in $processedFiles JSON files.');
}

/// Reorders keys alphabetically in a JSON file and writes the sorted content back.
Future<void> _reorderKeysInFile(File file) async {
  try {
    final content = await file.readAsString();
    if (content.trim().isEmpty) {
      log.warning('Empty file: ${file.path}');
      return;
    }

    final Map<String, dynamic> jsonMap = json.decode(content);

    // Create a new map with sorted keys
    final sortedMap = Map.fromEntries(
        jsonMap.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));

    // Write sorted map back to file
    await file.writeAsString(JsonEncoder.withIndent('  ').convert(sortedMap));
    log.fine('Reordered keys in: ${file.path}');
  } catch (e) {
    log.severe('Error processing ${file.path}: $e');
  }
}
