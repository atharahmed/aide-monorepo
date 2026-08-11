const adonisConfig = require('@adonisjs/prettier-config')

module.exports = {
  ...adonisConfig,
  plugins: [...(adonisConfig.plugins ?? []), 'prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/styles.css',
}
