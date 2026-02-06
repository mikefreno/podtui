# Config Persistence to XDG_CONFIG_HOME

Objective: Move feeds and themes persistence from localStorage to XDG_CONFIG_HOME directory

Status legend: [ ] todo, [~] in-progress, [x] done

Tasks
- [ ] 23 — Implement XDG_CONFIG_HOME directory setup → `23-config-directory-setup.md`
- [ ] 24 — Refactor feeds persistence to JSON file → `24-feeds-persistence-refactor.md`
- [ ] 25 — Refactor theme persistence to JSON file → `25-theme-persistence-refactor.md`
- [ ] 26 — Add config file validation and migration → `26-config-file-validation.md`
- [ ] 27 — Implement config file backup on update → `27-config-file-backup.md`

Dependencies
- 23 -> 24
- 23 -> 25
- 24 -> 26
- 25 -> 26
- 26 -> 27

Exit criteria
- Feeds are persisted to XDG_CONFIG_HOME/podcast-tui-app/feeds.json
- Themes are persisted to XDG_CONFIG_HOME/podcast-tui-app/themes.json
- Config file validation ensures data integrity
- Migration from localStorage works seamlessly
