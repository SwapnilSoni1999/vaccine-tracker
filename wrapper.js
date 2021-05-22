const { default: axios } = require('axios')
const crypto = require('crypto')
const { EventEmitter } = require('events')
const { httpsOverHttp } = require('tunnel')
const fs = require('fs')
const tools = require('./tools')

const em = new EventEmitter()

const secretKey = "b5cab167-7977-4df1-8027-a63aa144f04e"
const AES_KEY = "CoWIN@$#&*(!@%^&"

var requestCount = 0
const proxies = fs.readFileSync('proxies.txt').toString().split('\n').filter(line => !!line).map(line => ({ host: line.split(':')[0], port: line.split(':')[1] }))

const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0',
}

function getRandomAgent() {
    const agent = httpsOverHttp({ proxy: proxies[Math.floor(Math.random() * proxies.length)] })
    return agent
}

const sha256 = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex')
}

const verifyOtp = async (otp, txnId) => {
    try {
        const res = await axios({
            method: 'POST',
            url: 'http://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp',
            data: {
                otp: sha256(otp),
                txnId: txnId
            },
            headers,
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
        url: 'http://cdn-api.co-vin.in/api/v2/appointment/beneficiaries',
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
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${dateObj.getFullYear()}`
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
            secret: "U2FsdGVkX19at5EJPMYRe6TTDK4WWA2Nyb6b6c+QAmcYQjuhurrk6+CUqmMKHtSeaETDAIuXC+7Jz+ioZvkG+Q=="
        }
        const res = await axios({
            method: 'POST',
            url: 'http://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP',
            data: postData,
            headers,
            httpsAgent: getRandomAgent()
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
        const res = await axios({
            method: 'GET',
            url: 'http://cdn-api.co-vin.in/api/v2/admin/location/states',
            headers,
            httpsAgent: getRandomAgent()
        })
        return res.data.states
    }

    static async getDistrict(stateId) {
        const res = await axios({
            method: 'GET',
            url: 'http://cdn-api.co-vin.in/api/v2/admin/location/districts/' + stateId,
            headers,
            httpAgent: getRandomAgent()
        })
        return res.data.districts
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
                url: 'http://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin',
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

    static async schedule(token, payload={ beneficiaries, center_id, captcha, dose, slot, session_id }) {
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/appointment/schedule',
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
            date: getToday()
        }
        console.log(params)
        try {
            if (!token) {
                throw new Error('No token direct public request.')
            }
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
                // delete axiosConfig.httpsAgent
                requestCount = -1
            }
            const res = await axios(axiosConfig)
            requestCount++
            return res.data.centers
        } catch (err) {
            try {
                // console.log(err)
                if (requestCount < 0) {
                    requestCount = 0
                }
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
                    // delete axiosConfig.httpsAgent
                    requestCount = -1
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
    }
}

module.exports = { CoWIN, em }