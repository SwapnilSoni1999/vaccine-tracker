# Cowin Vaccine Tracker and AutoBooker

- A bot to track available slots and book them automaitcally before any human does around you. :)

### Features

- Track upto 4 pincodes
- Can track all pincodes/age group from owin website
- Can download Certificate after vaccination
- A status message to display your session time, Beneficiary you're booking for, snooze time and many more
- User friendly and guiding commands in each messages
- Fast and instant walkthrough to guide you for each step
- snoozing, to stop alerts for particular time without stopping the bot
- can track specific age group, vaccine, dose and pincode
- You can view number of users on the bot from different states and cities.
- **Automatic Slot booking**
- Has Seperate bot's login panel to authenticate with cowin

### Some internal code magic

- Has an API to build an autologin application. (Incomplete and abandoned)
- Has pincode, District caching
- automatically divides slot tracking by just providing proxies in proxies.txt (Calculated from cowin's rate limit, But since govt removed rate limit on public API, Its deprecated.)
- **Can bypass cache** (Having seperate explanation below.)
- Has seperate login panel to avoid authentication rate limiting from same IP, Instead a browser window will open and requests will be sent from user's device and token will be shared with bot after authentication.
- Cowin-like 180sec otp limiting.
- All the Phone, Pincode, State and many inputs are validated before proceeding further.
- A cron job to wipe server logs, Backup existing database and clear cache every night at 12
- Admin special commands to broadcast message to users, Check user availability, Logged in users, adjust sleeptime of tracker and tracker live status informer
- Snooze timestamp is stored in database and every slot availability message is checked before sending to user.
- A cron job to reset otp count of all users every night, Reason: Cowin bans account for 24hours if you requested more than 50 otp in 24 hours.

**Depreacated Thing**
- Before I knew about Cache bypassing, I used user's token to fetch data from private API endpoint. For eg. There are 40-50users booking vaccine slots using bot, So during that I take any random valid auth token and request on private API endpoint to fetch realtime data. But later I discovered cache bypass and reverted this logic.

#### How I bypassed cache on public API

- The cowin server uses GoLang in backend and uses a module called [dateparse](https://github.com/araddon/dateparse) This module can detect many date formats without even specifying.
  - So passing a date `26/11/2021` or `26/11/21` or `26-11-21` or even with zeros `06/04/2021` can be also written as `6/4/21` and so on
  - I created a date obfuscator present in `wrapper.js` with function `getToday`
  - The caching service uses, AWS. Which allowed cowin to cache request for few minutes. Now in this case those few minutes are cruicial.
  - I examined the request and the only thing was API path + query params. And a reponse header `x-amzn-remapped-date` which shows when the particular data was last cached on AWS servers.

- After using the date obfuscator I created, It successfully bypassed caching (you can check `x-amzn-remapped-date`)


### Before you criticize my code...

I know the coding structure is trash, I didn't followed time complexity properly. But the code is not repetitive.
But after all... I did these within a month, Moreover I released this bot in 3 days after 18+ vaccination started. Sine then I managed my worklife, real life and maintained this bot as well. So please bear with the code quality. :)

## Here are some appreciations I got
- Reel from Dhananjay Bhosale (Youtuber 300k+ subs): https://www.instagram.com/p/CSZXSyVHdtN/
- Reel from vivekartiste (Vivek Rajput) (15k+ insta followers): https://www.instagram.com/p/CSZbr_AJ-9D/
- Appreciation certificate from Jain University Bangalore. [link](https://imgur.com/a/iA0zVsb)
- Immense support from XDA-OFF TOPIC Group (Facebook.)

# License
&copy; Swapnil Soni (MIT)
(If you plan to copy the code then link the credits in your bot with a link to my github repo.)
