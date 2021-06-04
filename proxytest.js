const fs = require('fs')
const { default: axios } = require('axios')
const { httpsOverHttp } = require('tunnel')


const getToday = () => {
    const dateObj = new Date()
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${dateObj.getFullYear()}`
}
(async () => {
    const proxies = fs.readFileSync('proxies.txt').toString().split('\n').filter(line => !!line).map(line => ({ host: line.split(':')[0], port: line.split(':')[1] }))
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0',
    }
    console.log('Testing all proxies...')
    for (const proxy of proxies) {
        console.log()
        process.stdout.write(`${proxy.host}...\r`)
        const agent = httpsOverHttp({ proxy: { host: proxy.host, port: proxy.port } })
        const params = {
            pincode: '380061',
            date: getToday()
        }
        const axiosConfig = {
            method: 'GET',
            url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin',
            params,
            headers,
            httpsAgent: agent
        }
        try {
            const res = await axios(axiosConfig)
            if (res.status === 200) {
                process.stdout.write(`${proxy.host}...OK`)
            } else {
                process.stdout.write(`${proxy.host}...UNKOWN ERROR`)
            }
        } catch (err) {
            process.stdout.write(`${proxy.host}...DEAD`)
        }
    }
})() 


