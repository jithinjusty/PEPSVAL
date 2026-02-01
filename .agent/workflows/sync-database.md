---
description: Sync database changes to Supabase
---
Whenever you or I make changes to the database schema (SQL files), follow these steps to ensure the remote Supabase project is updated.

1. **Review SQL**: Open the relevant `.sql` file to ensure the queries are correct.
2. **Apply Migration**: Use the `apply_migration` tool to run the SQL on the Supabase project.
// turbo
3. **Execute SQL**: If the change is a simple data update or query, use `execute_sql`.
4. **Generate Types**: After any schema change, run the `generate_typescript_types` tool to update local type definitions.

> [!NOTE]
> I will automatically perform these steps whenever I modify SQL files in this project.
