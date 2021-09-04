const { default: axios } = require('axios')
const crypto = require('crypto')
const { EventEmitter } = require('events')
const { httpsOverHttp } = require('tunnel')
const fs = require('fs')
const tools = require('./tools')
const { Location } = require('./locationModel')

const em = new EventEmitter()

const secretKey = "b5cab167-7977-4df1-8027-a63aa144f04e"
const AES_KEY = "CoWIN@$#&*(!@%^&"

var requestCount = 0
const proxies = fs.readFileSync('proxies.txt').toString().split('\n')?.filter(line => !!line)?.map(line => ({ host: line.split(':')[0], port: line.split(':')[1] }))

const headers = {
    'authority': 'cdn-api.co-vin.in',
    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
    'accept': 'application/json, text/plain, */*',
    'sec-ch-ua-mobile': '?0',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
    'origin': 'https://selfregistration.cowin.gov.in',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'referer': 'https://selfregistration.cowin.gov.in/',
    'accept-language': 'en-US,en-IN;q=0.9,en;q=0.8',
}

function getRandomAgent() {
    if (!proxies.length) {
        return null
    }
    const agent = httpsOverHttp({ proxy: proxies[Math.floor(Math.random() * proxies.length)] })
    return agent
}

const sha256 = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex')
}

function randomstring(len) {
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const digits = '1234567890'
    const chars = lower + upper + digits
    let result = ''
    for (let i=0; i<len; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
}

const verifyOtp = async (otp, txnId) => {
    try {
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp',
            data: {
                otp: sha256(otp),
                txnId: txnId
            },
            headers: {
                'authority': 'cdn-api.co-vin.in',
                'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                'accept': 'application/json, text/plain, */*',
                'sec-ch-ua-mobile': '?0',
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
                'content-type': 'application/json',
                'origin': 'https://selfregistration.cowin.gov.in',
                'sec-fetch-site': 'cross-site',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'referer': 'https://selfregistration.cowin.gov.in/',
                'accept-language': 'en-US,en-IN;q=0.9,en;q=0.8',
            },
            httpsAgent: getRandomAgent()
        })
        console.log(res.data)
        // this.token = res.data.token
        return res.data.token
    } catch(err) {
        console.log(err)
        throw new Error('Invalid otp!')
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}

const _getBeneficiaries = async (token) => {
    const res = await axios({
        method: 'GET',
        url: 'https://cdn-api.co-vin.in/api/v2/appointment/beneficiaries',
        headers: {
            ...headers,
            authorization: 'Bearer ' + token
        },
        httpsAgent: getRandomAgent()
    })
    console.log(res.data)
    return res.data.beneficiaries
}

const getToday = () => {
    const dateObj = new Date()
    const seperators = [ '-', '/', '@', '!' ]
    // choose random seperator
    const seperator = seperators[Math.floor(Math.random() * seperators.length)]
    const pad = Math.floor(Math.random() * 100) % 2 === 0 ? 1 : 2
    const day = String(dateObj.getDate()).padStart(pad, '0')
    const month = String(dateObj.getMonth()+1).padStart(pad, '0')
    const yearFull = dateObj.getFullYear().toString()
    const year = Math.floor(Math.random() * 100) % 2 === 0 ? yearFull : yearFull.substr(-2)
    return [day, month, year].join(seperator)
}

// const proxies = fs.readFileSync('proxies.txt').toString('ascii').split('\n').map(line =>  ({ host: line.split(':')[0], port: line.split(':')[1] }))
// let currentProxy = proxies[Math.floor(Math.random() * proxies.length)]

class CoWIN {
    constructor(mobileNumber) {
        if (!mobileNumber) {
            throw new Error(`mobileNumber is required!`)
        }
        this.mobile = mobileNumber
        // return await this.sendOtp(mobileNumber)
    }
    async sendOtp() {
        const postData = {
            mobile: this.mobile,
            secret: "U2FsdGVkX18BUM3xhsRAs3GJT2PpZV1UFSdrdLzmgEKxiTmyTvBCvRjEPJT6w+mL7Tu9EneKydezRLPWDXGFdw=="
        }
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP',
            data: postData,
            headers
        })
        console.log(res.data)
        this.txnId = res.data.txnId
        return this.txnId
    }

    static async verifyOtpStatic(otp, txnId) {
        return verifyOtp(otp, txnId)
    }

    async verifyOtp(otp, txnId=null) {
        this.token = await verifyOtp(otp, txnId || this.txnId)
        return this.token
    }

    async getBeneficiaries() {
        return _getBeneficiaries(this.token)
    }

    static async getBeneficiariesStatic(token) {
        return _getBeneficiaries(token)
    }

    static async getStates() {
        if (fs.existsSync('states.json')) {
            const localStates = JSON.parse(fs.readFileSync('states.json'))
            if (localStates?.length) {
                return localStates
            }
        }
        const res = await axios({
            method: 'GET',
            url: 'https://cdn-api.co-vin.in/api/v2/admin/location/states',
            headers,
            httpsAgent: getRandomAgent()
        })
        fs.writeFileSync('states.json', JSON.stringify(res.data.states, null, '\t'))
        return res.data.states
    }

    static async getDistrict(stateId) {
        try {
            const { districts } = await Location.findOne({ stateId })
            if (districts.length) {
                return districts
            }
        } catch (err) {
            const res = await axios({
                method: 'GET',
                url: 'https://cdn-api.co-vin.in/api/v2/admin/location/districts/' + stateId,
                headers,
                httpAgent: getRandomAgent()
            })
            await Location.create({
                stateId, districts: res.data.districts
            })
            return res.data.districts
        }
    }

    /**
     * @deprecated
     */
    static async getCenters(pincode, token, vaccine=null) {
        let params = {
            pincode,
            date: getToday()
        }
        if (vaccine) {
            params.vaccine = vaccine
        }
        console.log(params)
        try {
            const agent = httpsOverHttp({ proxy: proxies[requestCount] })
            console.log('Request Count:', requestCount)
            console.log('Proxy:', proxies[requestCount] || 'Using system\'s IP')
            const axiosConfig = {
                method: 'GET',
                url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin',
                params,
                headers,
                httpsAgent: agent
            }
            if (requestCount >= proxies.length) {
                delete axiosConfig.httpsAgent
                requestCount = 0
            }
            const res = await axios(axiosConfig)
            requestCount++
            return res.data.centers
        } catch (err) {
            console.log(err)
            if (err.response.status == 403) {
                console.log("Rate limit exceeded! Waiting for 10 minutes...")
                await sleep(10* 60 * 1000)
                em.emit('rate-limit')
                // currentProxy = proxies[Math.floor(Math.random() * proxies.length)]
                return
            }
            const centers = []
            requestCount++
            return centers
        }
    }

    /**
     * returns solved captcha
     */
    static async getCaptcha(token, chatId) {
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/auth/getRecaptcha',
            data: '{}',
            headers: {
                ...headers,
                authorization: 'Bearer ' + token
            },
            httpsAgent: getRandomAgent()
        })
        const svgCode = res.data.captcha
        const result = await tools.solveCaptcha(svgCode, chatId)
        return result
    }

    static async schedule(token, payload, _pre) {
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/appointment/' + _pre,
            headers: {
                ...headers,
                authorization: 'Bearer ' + token
            },
            data: payload,
            httpsAgent: getRandomAgent()
        })
        return res.data.appointment_confirmation_no
    }

    static async getAppointmentSlip(appointmentId, token, chatId) {
        const res = await axios({
            method: 'GET',
            url: 'https://cdn-api.co-vin.in/api/v2/appointment/appointmentslip/download',
            headers: {
                ...headers,
                accept: 'application/pdf',
                authorization: 'Bearer ' + token
            },
            params: {
                appointment_id: appointmentId
            },
            responseType: 'arraybuffer',
            httpsAgent: getRandomAgent()
        })
        const outputPath = `./appointments/Appointment-Slip_${chatId}.pdf`
        fs.writeFileSync(outputPath, res.data, 'binary')
        return outputPath
    }

    static async getCentersByDist(districtId, token) {
        const params = {
            district_id: districtId,
            date: getToday(),
        }
        console.log(params)
        try {
            if (!token) {
                throw new Error('No token direct public request.')
            }
            if (proxies.length) {
                const agent = httpsOverHttp({ proxy: proxies[requestCount] })
                console.log('Request Count:', requestCount, 'API: Private')
                console.log('Proxy:', proxies[requestCount] || 'Using system\'s IP')
                const axiosConfig = {
                    method: 'GET',
                    url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict',
                    params,
                    headers: {
                        ...headers,
                        authorization: 'Bearer ' + token
                    },
                    httpsAgent: agent
                }
                if (requestCount >= proxies.length-1) {
                    delete axiosConfig.httpsAgent
                    requestCount = -1
                }
                const res = await axios(axiosConfig)
                requestCount++
                return res.data.centers
            } else {
                const axiosConfig = {
                    method: 'GET',
                    url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict',
                    params,
                    headers: {
                        ...headers,
                        authorization: 'Bearer ' + token
                    },
                }
                const res = await axios(axiosConfig)
                requestCount++
                return res.data.centers
            }
        } catch (err) {
            try {
                console.log(err?.response?.data)
                if (requestCount < 0) {
                    requestCount = 0
                }
                if (proxies.length) {
                    const agent = httpsOverHttp({ proxy: proxies[requestCount] })
                    console.log('Request Count:', requestCount, 'API: Public')
                    console.log('Proxy:', proxies[requestCount] || 'Using system\'s IP')
                    const axiosConfig = {
                        method: 'GET',
                        url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict',
                        params,
                        headers,
                        httpsAgent: agent
                    }
                    if (requestCount >= proxies.length-1) {
                        delete axiosConfig.httpsAgent
                        requestCount = -1
                    }
                    const res = await axios(axiosConfig)
                    requestCount++
                    return res.data.centers
                } else {
                    const axiosConfig = {
                        method: 'GET',
                        url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict',
                        params,
                        headers
                    }
                    const res = await axios(axiosConfig)
                    requestCount++
                    return res.data.centers
                }
            } catch (err) {
                console.log(err)
                if (err.response.status == 403) {
                    console.log("Rate limit exceeded! Waiting for 10 minutes...")
                    await sleep(10* 60 * 1000)
                    em.emit('rate-limit')
                    // currentProxy = proxies[Math.floor(Math.random() * proxies.length)]
                    return
                }
                const centers = []
                requestCount++
                return centers
            }

        }
    }

    static async downloadCertificate(beneficiary_reference_id, token, chatId) {
        const res = await axios({
            method: 'GET',
            url: 'https://www.cowin.gov.in/api/v2/registration/certificate/download',
            params: {
                beneficiary_reference_id
            },
            headers: {
                ...headers,
                authorization: 'Bearer ' + token
            },
            responseType: 'arraybuffer'
        })
        const outputPath = `./certificates/Certificate_${chatId}.pdf`
        fs.writeFileSync(outputPath, res.data, 'binary')
        return outputPath
    }
}

module.exports = { CoWIN, em }