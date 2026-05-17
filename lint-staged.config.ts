export default {
  "*.*": ["npx prettier --write"],
  "*.ts": [() => "npx tsc --noEmit", "npx eslint"],
};
