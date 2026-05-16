export default {
  "*.*": ["prettier --write"],
  "*.ts": [() => "tsc --noEmit", "eslint"],
};
