# 26. Add Config File Validation and Migration

meta:
  id: config-persistence-26
  feature: config-persistence
  priority: P1
  depends_on: [config-persistence-24, config-persistence-25]
  tags: [validation, migration, data-integrity]

objective:
- Validate config file structure and data integrity
- Migrate data from localStorage to file
- Provide migration on first run
- Handle config file corruption

deliverables:
- Config file validation function
- Migration utility from localStorage
- Error handling for corrupted files

steps:
1. Create config file schema validation
2. Implement migration from localStorage to file
3. Add config file backup before migration
4. Handle corrupted JSON files
5. Test migration scenarios

tests:
- Unit: Test validation function
- Integration: Test migration from localStorage
- Error: Test corrupted file handling

acceptance_criteria:
- Config files are validated before use
- Migration from localStorage works seamlessly
- Corrupted files are handled gracefully

validation:
- Start app with localStorage data
- Verify migration to file
- Corrupt file and verify handling
- Test migration on app restart

notes:
- Validate Feed type structure
- Validate theme structure
- Create backup before migration
- Log migration events
- Provide error messages for corrupted files
- Add config file versioning
- Test with both new and old data formats
