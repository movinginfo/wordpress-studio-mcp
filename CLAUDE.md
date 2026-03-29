# WordPress Studio MCP — Claude Code Context

This project is **wordpress-studio-mcp** — a local MCP server that gives Claude direct access to WordPress Studio sites running on this machine.

All 71 tools are available in this session under the `mcp__wordpress-studio-mcp__*` namespace.

---

## Your WordPress Studio Sites

Run `mcp__wordpress-studio-mcp__studio_registry` to see all sites with ports and URLs.

Common sites on this machine:
- **i-help.us** — custom domain, HTTPS via mkcert (`https://i-help.us`)

Studio home: `~/.studio/cli.json`
Sites root: `~/Studio/`

---

## Tool Categories (71 tools)

### Site Registry & Status
| Tool | When to use |
|---|---|
| `studio_registry` | List all sites, ports, URLs, paths |
| `studio_site_health` | HTTP health check on a running site |
| `studio_daemon_status` | Check if Studio process manager is running |
| `studio_disk_usage` | Disk usage per site |
| `studio_auth_status` | WordPress.com OAuth token status |
| `studio_config_dump` | Raw Studio config (secrets redacted) |

### Filesystem
| Tool | When to use |
|---|---|
| `fs_read_file` | Read any file inside a site (`--site`, `--path`) |
| `fs_write_file` | Write/create a file inside a site |
| `fs_list_dir` | List directory contents |
| `fs_find_files` | Glob search inside a site |
| `fs_read_wp_config` | Read and parse wp-config.php |
| `fs_read_error_log` | Tail WordPress debug.log (last N lines) |

### Database
| Tool | When to use |
|---|---|
| `db_query` | SELECT queries on the SQLite database |
| `db_execute` | INSERT / UPDATE / DELETE |
| `db_list_tables` | List all tables |
| `db_describe_table` | Column names, types, constraints |
| `db_export_sql` | Export full database as SQL dump |

### WP-CLI
| Tool | When to use |
|---|---|
| `wpcli_run` | Run any WP-CLI command (`--cmd "cache flush"`) |
| `wpcli_plugin_list` | List plugins with status and version |
| `wpcli_plugin_install` | Install a plugin from wordpress.org |
| `wpcli_plugin_deactivate` | Deactivate a plugin |
| `wpcli_theme_list` | List themes |
| `wpcli_theme_activate` | Activate a theme |
| `wpcli_user_list` | List WordPress users |
| `wpcli_create_admin` | Create an admin user |
| `wpcli_search_replace` | Database search-replace (URL migration) |
| `wpcli_cache_flush` | Flush object cache and transients |
| `wpcli_core_update` | Update WordPress core |
| `wpcli_db_backup` | Export database to .sql file |
| `wpcli_cron_list` | List scheduled cron events |
| `wpcli_update_all` | Update all plugins and/or themes |

### REST API
| Tool | When to use |
|---|---|
| `wp_rest_get` | GET request to local site REST API |
| `wp_rest_request` | POST/PUT/PATCH/DELETE to REST API |
| `wp_rest_routes` | List all REST routes |
| `wp_rest_posts` | List posts via REST |
| `wp_rest_users` | List users via REST |
| `wp_rest_taxonomies` | List categories/tags via REST |
| `wp_rest_settings` | Read site settings via REST |
| `wp_theme_json` | Read theme.json from active theme |

### WordPress.com
| Tool | When to use |
|---|---|
| `wpcom_api_get` | Authenticated GET to WP.com API |
| `wpcom_api_post` | Authenticated POST to WP.com API |
| `wpcom_site_info` | WP.com site metadata |
| `wpcom_posts` | List posts from WP.com site |
| `wpcom_stats` | Traffic stats |
| `wpcom_media` | Media library |
| `wpcom_mcp_call` | Proxy MCP call to official WP.com MCP |
| `wpcom_theme_context` | Theme design context |

### Administration & Security
| Tool | When to use |
|---|---|
| `wp_config_set` | Add/update/remove wp-config.php constants |
| `wp_security_audit` | Security checklist (debug, file edit, SSL, etc.) |
| `wp_php_info` | PHP version, memory limits, upload sizes |

### Domain & HTTPS
| Tool | When to use |
|---|---|
| `studio_site_set_domain` | Map a real domain to a Studio site |
| `studio_site_remove_domain` | Remove custom domain mapping |
| `studio_domain_list` | List all custom domain mappings |
| `studio_site_use_mkcert` | Generate browser-trusted HTTPS cert via mkcert |

### Blueprints
| Tool | When to use |
|---|---|
| `studio_blueprint_list` | List built-in Studio blueprints |
| `studio_blueprint_generate` | Snapshot a site into Blueprint JSON |
| `studio_blueprint_apply` | Apply Blueprint JSON to a site |

### VIP Design
| Tool | When to use |
|---|---|
| `vip_design_tokens` | Query Automattic VIP Design System tokens |
| `vip_design_theme_json` | Generate theme.json from VIP tokens |

### WordPress Abilities API
| Tool | When to use |
|---|---|
| `wp_mcp_adapter_setup` | Install abilities-api + mcp-adapter plugins |
| `wp_abilities_discover` | List all public abilities on a site |
| `wp_abilities_info` | Get schema for a specific ability |
| `wp_abilities_call` | Execute an ability with params |

### Xdebug
| Tool | When to use |
|---|---|
| `studio_xdebug_enable` | Enable Xdebug (one site at a time, `--confirmed true`) |
| `studio_xdebug_disable` | Disable Xdebug |
| `studio_xdebug_status` | Show which site has Xdebug active |
| `studio_xdebug_ide_config` | Generate VS Code launch.json or PhpStorm config |

### Marketing Skills
| Tool | When to use |
|---|---|
| `marketing_skills_list` | Browse 34 marketing skills by category |
| `marketing_skills_install` | Install skills (`--skills all --scope global`) |
| `marketing_skills_status` | Show installed coverage |
| `marketing_skills_context` | Foundation skill setup guide |

---

## Common Workflows

### Inspect a site
```
studio_registry                          → find site name and port
studio_site_health  --site <name>        → verify it's running
fs_read_wp_config   --site <name>        → check constants
wp_php_info         --site <name>        → PHP config
```

### Debug a problem
```
fs_read_error_log   --site <name>        → last 50 lines of debug.log
db_query  --site <name>  --sql "SELECT * FROM wp_options WHERE option_name='siteurl'"
wpcli_run  --site <name>  --cmd "debug info"
```

### Plugin management
```
wpcli_plugin_list       --site <name>
wpcli_plugin_install    --site <name>  --plugin woocommerce  --activate true
wpcli_plugin_deactivate --site <name>  --plugin woocommerce
```

### Database operations
```
db_list_tables    --site <name>
db_query          --site <name>  --sql "SELECT option_name, option_value FROM wp_options LIMIT 10"
db_export_sql     --site <name>
wpcli_db_backup   --site <name>
```

### URL migration / domain change
```
studio_site_set_domain    --site <name>  --domain example.com  --confirmed true
wpcli_search_replace      --site <name>  --search http://localhost:8881  --replace https://example.com
studio_site_use_mkcert    --site <name>  --domain example.com  --confirmed true
```

### Security hardening
```
wp_security_audit   --site <name>
wp_config_set       --site <name>  --key DISALLOW_FILE_EDIT  --value true  --type bool
wp_config_set       --site <name>  --key WP_DEBUG  --value false  --type bool
```

### Xdebug + VS Code
```
studio_xdebug_enable      --site <name>  --confirmed true
studio_xdebug_ide_config  --site <name>  --ide vscode  --write_file true
```
Then restart the site in Studio and press F5 in VS Code.

---

## Terminal CLI

All tools are also available from the terminal without Claude:

```powershell
wpstudio list                                  # all 71 tools
wpstudio studio-registry                       # list sites
wpstudio wpcli-plugin-list --site i-help.us
wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 5"
```

Install once: `cd "C:\Work\Wordpress Studio MCP Plugin for Claude Code" && npm link`

---

## Key Paths

| Path | Purpose |
|---|---|
| `~/.studio/cli.json` | Site registry — IDs, ports, domains, paths |
| `~/.studio/certificates/domains/` | Per-domain TLS certs |
| `~/Studio/` | Site root directories |
| `C:\Work\Wordpress Studio MCP Plugin for Claude Code\` | This MCP server project |
| `dist/index.js` | Compiled MCP server entry point |

---

## Environment Variables

| Variable | Default | Override |
|---|---|---|
| `STUDIO_HOME` | `~/.studio` | Set in MCP server env config |
| `STUDIO_SITES_ROOT` | `~/Studio/sites` | Set in MCP server env config |
