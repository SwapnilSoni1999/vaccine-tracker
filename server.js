require('dotenv').config()
const bot = require('./bot')
const app = require('./app')

const PORT = 6969

app.listen(PORT, () => console.log('Server started!'))
bot.launch()
