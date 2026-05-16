export default {
  "*.ts": [() => "tsc --noEmit", "prettier --write", "eslint"],
};
