# Cowin Vaccine Tracker and AutoBooking bot

- A bot to track available slots and book them automatically before any human around you does. :)

### Features

- Track upto 4 pincodes
- Can track all pincodes/age group from Cowin website
- Can download Certificate after vaccination
- A status message to display your session time, beneficiaries you're booking for, snooze time and many more
- User friendly and guiding commands in each message
- Fast and instant walkthrough to guide you at each step
- Snooze, to stop alerts for particular time without stopping the bot
- Can track specific age group, vaccine, dose and pincode
- You can view number of users on the bot from different states and cities.
- **Automatic Slot booking**
- Has Seperate bot's login panel to authenticate with cowin

### Some internal code magic

- Has an API to build an autologin application. (Incomplete and abandoned)
- Has pincode and District caching
- Automatically divides slot tracking by just providing proxies in proxies.txt (Calculated from cowin's rate limit, But since govt removed rate limit on public API, Its deprecated.)
- **Can bypass cache** (Has a seperate description below.)
- Has seperate login panel to avoid authentication rate limiting from same IP, Instead a browser window will open and requests will be sent from user's device and token will be shared with bot after authentication.
- Cowin-like 180sec otp limiting.
- All the Phone, Pincode, State and other inputs are validated before proceeding further.
- A cron job to wipe server logs, Backup existing database and clear cache every midnight
- Admin restricted commands to broadcast messages to users, Check user availability, Logged in users, adjust sleeptime of tracker and tracker live status informer
- Snooze timestamp is stored in database and every slot availability message is checked before sending to user.
- A cron job to reset otp count of all users every night, Reason: Cowin bans account for 24hours if you requested more than 50 otp in 24 hours.

**Depreacation**
- Before knowing about Cache bypassing, I used user's token to fetch data from private API endpoint. For eg. There are 40-50 users booking vaccine slots using the bot, So during that I took any random valid auth token and requested on private API endpoint to fetch realtime data. But later I discovered cache bypass and reverted this logic.

#### How I bypassed cache on public API

- The cowin server uses GoLang in backend and uses a module called [dateparse](https://github.com/araddon/dateparse) This module can detect many date formats without even specifying.
  - So passing a date `26/11/2021` or `26/11/21` or `26-11-21` or even with zeros `06/04/2021` can be also written as `6/4/21` and so on
  - I created a date obfuscator present in `wrapper.js` with function `getToday`
  - The caching service uses, AWS. Which allowed cowin to cache request for few minutes. Now in this case those few minutes are cruicial.
  - I examined the request and the only thing was API path + query params. And a reponse header `x-amzn-remapped-date` which shows when the particular data was last cached on AWS servers.

- After using the date obfuscator that I had created, It successfully bypassed caching (you can check `x-amzn-remapped-date`)


### Before you criticize my code... xD

I know the coding structure is trash, I didn't follow the time complexity properly. But the code is not repetitive.
But after all... I built this within a month, Moreover I released this bot in just 3 days after 18+ vaccination started. Since then I managed my worklife, real life and maintained this bot as well. So please bear with the code quality. :)

## Here are some appreciations I got
- Reel from Dhananjay Bhosale (Youtuber 300k+ subs): https://www.instagram.com/p/CSZXSyVHdtN/
- Reel from vivekartiste (Vivek Rajput) (15k+ insta followers): https://www.instagram.com/p/CSZbr_AJ-9D/
- Appreciation certificate from Jain University Bangalore. [link](https://imgur.com/a/iA0zVsb)
- Immense support from XDA-OFF TOPIC Group (Facebook.)

# License
&copy; Swapnil Soni (MIT)
(If you plan to copy the code then link the credits in your bot with a link to my github repo.)

