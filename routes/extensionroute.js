const express = require('express');
const puppeteer = require('puppeteer');
const { CleanHTMLData, CleanDBData, generateRandomCode } = require('../config/sanitization');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LinkedAccount = require('../models/LinkedAccount');
const CommentSetting = require('../models/CommentSetting');
const { backendURL } = require('../config/sanitization');
const LinkedAccountTone = require('../models/LinkedAccountTone');

// Keep Puppeteer browser persistent (launch once, reuse pages)
let browserInstance;

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: 'new', // Use 'new' for better performance
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }
    return browserInstance;
}



router.post('/cookiesData', async (req, res) => {
    const postData = req.body;
    console.log("🚀 Received cookie data:", postData);

    let cookie = postData.cookies;
    const token = postData.token;

    try {
        const decoded = jwt.decode(token);
        const userid = decoded.id;

        let li_at = cookie.find(c => c.name === 'li_at');

        const user = await User.findById(userid);
        let filteredCookies = user.packageid == '67af47a217c599cb9a59e24e'
            ? cookie.filter(c => c.name !== "li_at")
            : cookie;

        await User.findOneAndUpdate(
            { _id: userid },
            { cookie: JSON.stringify(filteredCookies), cookieStatus: true, extensionStatus: true },
            { new: true, upsert: true }
        );

        const browser = await getBrowser();
        const page = await browser.newPage();

        // Set cookies for LinkedIn
        await page.setCookie({
            name: 'li_at',
            value: li_at?.value,
            domain: '.www.linkedin.com',
            path: '/',
            secure: true,
            httpOnly: true,
            session: false,
            expires: 1769167122.700562,
        });

        console.log("✅ Cookie set successfully.");

        // Navigate directly to LinkedIn profile
        await page.goto("https://www.linkedin.com/in/me/", { waitUntil: 'domcontentloaded' });

        // Extract profile data using faster parallel fetching
        const profileData = await page.evaluate(() => {
            return {
                imageUrl: document.querySelector("img.evi-image.ember-view.profile-photo-edit__preview")?.src || 'user.png',
                name: document.querySelector("h1.inline.t-24.v-align-middle.break-words")?.innerText.trim() || 'No Name found',
                tagLine: document.querySelector('.text-body-medium.break-words[data-generated-suggestion-target]')?.innerText.trim() || 'No Tag Line found',
                profileLink: document.querySelector('p.t-14.t-normal.t-black--light.pt1.break-words')?.innerText.trim() || 'No Profile Link found',
            };
        },);

        console.log("🔹 Profile Data:", profileData);

        // Check if company section exists (faster check using `evaluate`)
        await page.goto("https://www.linkedin.com/feed/", { waitUntil: 'domcontentloaded' });

        const companySelector = ".org-organization-admin-pages-entrypoint-card__item";
        const nameSelector = "span.text-body-xsmall-bold.t-black";
        const urlSelector = "a";
        const imgSelector = "img";

        const pageData = await page.evaluate((companySelector, nameSelector, urlSelector, imgSelector) => {
            let companies = [];
            document.querySelectorAll(companySelector).forEach((item) => {
                let name = item.querySelector(nameSelector)?.innerText.trim();
                let url = item.querySelector(urlSelector)?.getAttribute("href");
                let imgUrl = item.querySelector(imgSelector)?.getAttribute("src");

                if (name && url) {
                    companies.push({_id: url.match(/company\/(\d+)/)?.[1], name, url: `https://www.linkedin.com${url}`, imgUrl, status: false, });
                }
            });

            return companies.length > 0 ? JSON.stringify(companies) : "No company found";
        },
            companySelector, nameSelector, urlSelector, imgSelector
        );

        console.log("🏢 Company Data:", pageData);

        const Linkacc = await LinkedAccount.findOneAndUpdate(
            { userid: userid, url: profileData?.profileLink },
            { name: profileData?.name, imageUrl: profileData?.imageUrl, tagLine: profileData?.tagLine, pageData, status: 'active' },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Use findOneAndUpdate to either update or create a CommentSetting
        await CommentSetting.findOneAndUpdate(
            { linkedAccountId: Linkacc?._id },
            {
                creatorid: "0", emojis: false, hashtag: false, lowercase: false,
                exclamation: false, author: false, status: true
            },
            { upsert: true, new: true, }
        );

        await LinkedAccountTone.findOneAndUpdate(
            { linkedAccountId: Linkacc?._id },
            {
                userid, tone: "friendly", formalityLevel: "semiFormal",
                questionsFrequency: "sometimes", commentsLength: "medium", personality: "optimistic",
            },
            { upsert: true, new: true, }
        );

        const linkedAccountPageUrlId = JSON.parse(pageData).map(item => item._id );

        // console.log("🚀 ~ router.post ~ linkedAccountPageUrlId:", linkedAccountPageUrlId)

        for (const element of linkedAccountPageUrlId) {
            const id = element
            await LinkedAccountTone.findOneAndUpdate(
                { linkedAccountPageId: id },
                {
                    userid, tone: "friendly", formalityLevel: "semiFormal", linkedAccountId: Linkacc?._id,
                    questionsFrequency: "sometimes", commentsLength: "medium", personality: "optimistic",
                },
                { upsert: true, new: true, }
            );
        }
        
        await page.close(); // Close only the page, keep browser open

        res.json({ status: "success", message: "Fetched LinkedIn data" });

    } catch (err) {
        console.error("❌ Error:", err);
        res.json({ status: "error", message: "Something went wrong" });
    }
});
// router.post('/cookiesData', async (req, res) => {
//     const postData = req.body;
//     console.log("🚀 ~ router.post ~ postData:", postData);

//     // Keep cookie as an array
//     let cookie = postData.cookies;
//     const token = CleanHTMLData(CleanDBData(postData.token));

//     try {
//         const decoded = jwt.decode(token);
//         const userid = decoded.id;

//         // Loop over cookies if needed
//         let li_at = cookie.find(cookie => cookie.name === 'li_at');
//         // console.log('li_at', li_at?.value);

//         const user = await User.findById(userid);
//         let cookieFilter = cookie
//         if (user.packageid == '67af47a217c599cb9a59e24e') {
//             cookieFilter = cookie.filter(cookie => cookie.name !== "li_at");
//         }

//         // Stringify cookie only when updating the database
//         const updatedCookie = JSON.stringify(cookieFilter);

//         await User.findOneAndUpdate(
//             { _id: userid }, // Find user by id
//             { cookie: updatedCookie, cookieStatus: true, extensionStatus: true }, // Update the cookie field
//             { new: true, upsert: true } // 'new' returns the updated document, 'upsert' creates a new one if it doesn't exist
//         );

//         let browser = await puppeteer.launch({
//             headless: false,
//             args: ['--start-maximized'], // Maximizes the browser window
//             defaultViewport: null, // Ensures no viewport resizing
//         });

//         let page = await browser.newPage();

//         // Set LinkedIn cookie to maintain session
//         await page.setCookie({
//             name: 'li_at',
//             value: li_at?.value,
//             domain: '.www.linkedin.com',
//             path: '/',
//             secure: true,
//             httpOnly: true,
//             session: false,
//             expires: 1769167122.700562,
//         });
//         console.log("Cookie set successfully. in extension route");

//         const url = 'https://www.linkedin.com/in/me/'
//         await page.goto(url, { waitUntil: 'load', timeout: 60000 });
//         // await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

//         console.log("Cookie set successfully. in extension route");

//         const htmlSelector = "img.evi-image.ember-view.profile-photo-edit__preview"; // Profile image
//         const nameSelector = "h1.inline.t-24.v-align-middle.break-words"; // Name
//         const tagLineSelector = '.text-body-medium.break-words[data-generated-suggestion-target]'; // Tagline
//         const urlSelector = 'p.t-14.t-normal.t-black--light.pt1.break-words'; // Profile Url

//         // await page.waitForSelector(htmlSelector);
//         await page.waitForSelector(nameSelector);
//         // await page.waitForSelector(tagLineSelector);
//         await page.waitForSelector(urlSelector);

//         const ProfileData = await page.evaluate((htmlSelector, nameSelector, tagLineSelector, urlSelector) => {
//             const imageUrl = document.querySelector(htmlSelector)?.src || 'No image found';
//             const name = document.querySelector(nameSelector)?.innerText.trim() || 'No Name found';
//             const tagLine = document.querySelector(tagLineSelector)?.innerText.trim() || 'No Tag Line found';
//             const profileLink = document.querySelector(urlSelector)?.innerText.trim() || 'No Profile Link found';
//             return { imageUrl, name, tagLine, profileLink };
//         }, htmlSelector, nameSelector, tagLineSelector, urlSelector);

//         console.log('Profile Data:', ProfileData);

//         await page.goto("https://www.linkedin.com/feed/", { waitUntil: 'load', timeout: 60000 });

//         // Check if the company section exists before waiting
//         const hasCompanySection = await page.$(".org-organization-admin-pages-entrypoint-card__item");

//         let pageData;
//         if (hasCompanySection) {
//             // Extract company names and URLs
//             pageData = await page.evaluate(() => {
//                 let companies = [];
//                 document.querySelectorAll(".org-organization-admin-pages-entrypoint-card__item").forEach((item) => {
//                     let name = item.querySelector("span.text-body-xsmall-bold.t-black")?.innerText.trim();
//                     let url = item.querySelector("a")?.getAttribute("href");
//                     let imgUrl = item.querySelector("img")?.getAttribute("src");

//                     if (name && url) {
//                         companies.push({ name, url: `https://www.linkedin.com${url}`, imgUrl });
//                     }
//                 });
//                 return companies.length > 0 ? JSON.stringify(companies) : "No company found";
//             });
//         } else {
//             pageData = "No company found";
//         }
//         console.log('Page Data:', pageData);

//         await LinkedAccount.findOneAndUpdate(
//             { userid: userid, url: ProfileData?.profileLink }, // Search criteria
//             {
//                 name: ProfileData?.name,
//                 imageUrl: ProfileData?.imageUrl,
//                 tagLine: ProfileData?.tagLine,
//                 pageData: pageData,
//                 status: 'active'
//             },
//             { upsert: true, new: true, setDefaultsOnInsert: true } // Options
//         );

//         await browser.close();

//         res.json({
//             status: "success",
//             message: `get cookie data`,
//         });
//     } catch (err) {
//         console.error(err);
//         res.json({
//             status: "error",
//             message: "Something went wrong",
//         });
//     }
// });


router.post('/extensionInstallStatus', async (req, res) => {
    const postData = req.body;
    const token = CleanHTMLData(CleanDBData(postData.token));
    try {
        const decoded = jwt.decode(token);
        // console.log('Decoded JWT:', decoded.id);
        // const verified = jwt.verify(token, process.env.JWT_SECRET);
        // console.log('Verified JWT:', verified);
        // console.log("🚀 ~ router.post ~ cookie:", cookie)
        await User.findOneAndUpdate(
            { _id: decoded.id }, // Find user by id
            { extensionStatus: true },           // Update the cookie field
            { new: true, upsert: true } // 'new' returns the updated document, 'upsert' creates a new one if it doesn't exist
        );

        res.json({
            status: "success",
            message: `extension added`,
        });
    } catch (err) {
        console.error(err);
        res.json({
            status: "error",
            message: "Something want wrong",
        });
    }
});



module.exports = router;
