const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto-js");
const { CleanHTMLData, CleanDBData, checkAuthorization, backendURL, } = require("../config/sanitization");
const multer = require("multer");
const path = require("path");
const emailTemplate = require("../helpers/emailTemplates/emailTemplates");
const User = require("../models/User");
const CommentSetting = require("../models/CommentSetting");
const puppeteer = require("puppeteer");
const Creator = require("../models/Creator");
const { capitalizeName } = require("../helpers/functions");
const Keyword = require("../models/Keyword");
const CommentDetail = require("../models/CommentDetail");
const OpenAI = require("openai");
const Package = require("../models/Package");
const UserGeneralDetail = require("../models/UserGeneralDetail");
const Setting = require("../models/Setting");
const LinkedAccount = require("../models/LinkedAccount");
const PackageDetail = require("../models/PackageDetail");
const LinkedAccountTone = require("../models/LinkedAccountTone");
const fs = require("fs");

const jwtSecretKey = process.env.JWT_SECRET;
const encryptionKey = process.env.KEY;
const openApiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: openApiKey,
});

router.post("/googleLoginStoreData", async (req, res) => {
  const postData = req.body;
  const email = CleanHTMLData(CleanDBData(postData.email));
  const username = CleanHTMLData(CleanDBData(postData.username));
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));

  try {
    const token = jwt.sign({ username }, jwtSecretKey, { expiresIn: "12h" });

    // Check if user exists
    let user = await User.findOne({ username });

    if (user) {
      // User exists
      res.json({
        status: "success",
        message: "User logged in successfully.",
        token,
      });
    } else {
      // Create new user
      user = new User({
        username,
        email,
        firstName,
        lastName,
        loginType: "google",
      });

      await user.save();

      const newCommentSetting = new CommentSetting({
        userid: user._id.toString(),
        emojis: false,
        hashtag: false,
        lowercase: false,
        exclamation: false,
      });
      await newCommentSetting.save();

      res.json({
        status: "success",
        message: "User registered and logged in successfully.",
        token,
      });
    }
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/register", async (req, res) => {
  const postData = req.body;
  const email = CleanHTMLData(CleanDBData(postData.email));
  const password = CleanHTMLData(CleanDBData(postData.password));
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));

  try {
    // Check if email already exists
    if (await User.findOne({ email })) {
      return res.json({
        status: "error",
        message: "Email already exists",
      });
    }

    // Generate hashed and encrypted password
    const salt = bcrypt.genSaltSync(12);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const encryptedPassword = crypto.AES.encrypt(hashedPassword, encryptionKey).toString();

    // Create and save the user
    const newUser = new User({
      password: encryptedPassword,
      email,
      loginType: "email",
      firstName,
      lastName,
      emailStatus: "unverified",
      extensionStatus: false,
      cookieStatus: false,
      image: 'user.png'
    });

    await newUser.save();

    if (newUser.image) {
      newUser.image = `${backendURL}uploads/images/${newUser.image}`
    }

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      status: "success",
      message: "Registration successful.",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Server error occurred during registration.",
    });
  }
});

router.post("/login", async (req, res) => {
  const postData = req.body;
  const emailOrUsername = CleanHTMLData(CleanDBData(postData.identifier));
  const password = CleanHTMLData(CleanDBData(postData.password));
  try {
    // Find the user by email or username
    let user = await User.findOne({
      email: emailOrUsername,
    });

    if (!user) {
      return res.json({
        status: "error",
        message: "Email is incorrect",
      });
    }

    const decryptedPassword = crypto.AES.decrypt(user.password, encryptionKey).toString(crypto.enc.Utf8);
    const passwordMatched = await bcrypt.compare(password, decryptedPassword);
    if (!passwordMatched) {
      return res.json({
        status: "error",
        message: "Password is incorrect",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Log successful login

    if (user.image) {
      user.image = `${backendURL}uploads/images/${user.image}`
    }

    res.json({
      status: "success",
      message: "Logged in successfully!",
      token,
      user,
    });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", message: "Internal Server Error" });
  }
});

router.post("/verifyToken", async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    // console.log("🚀 ~ exports.verifyToken= ~ authUser:", typeof authUser, authUser)
    if (authUser) {
      let user = await User.findById(authUser);
      const pkgData = await Package.findById(user.packageid);
      // console.log("pkgData", pkgData);
      user = { ...user.toObject(), pkgData };
      if (user.image) {
        user.image = `${backendURL}uploads/images/${user.image}`
      }

      res.json({ status: "success", user });
    }
  } catch (error) {
    console.log("error:", error);
    res.json({ status: "error", message: "Error fetching user profile" });
  }
});

// router.post("/getCommentSetting", async (req, res) => {
//   const postData = req.body;
//   const userid = CleanHTMLData(CleanDBData(postData.userid));

//   try {
//     const authUser = await checkAuthorization(req, res);
//     if (authUser) {
//       const data = await CommentSetting.findOne({ userid: authUser });

//       res.json({
//         status: "success",
//         data: data,
//       });
//     }
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Server error occurred during registration.",
//     });
//   }
// });

router.post("/getPlans", async (req, res) => {
  const postData = req.body;
  const userid = CleanHTMLData(CleanDBData(postData.userid));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await Package.find({ type: "default" });

      res.json({
        status: "success",
        data: data,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Server error occurred during registration.",
    });
  }
});

router.post("/updatePlan", async (req, res) => {
  const postData = req.body;
  const newPkgId = postData?.newPkgId;
  const type = postData?.type;
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const user = await User.findOne({ _id: authUser }); // Find the user by ID
      user.packageid = newPkgId; // Assign new package ID
      await user.save(); // Save the updated user document
      const pkgData = await Package.findById(user.packageid);

      const daysToAdd = 30;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysToAdd); // Add 30 days
      const formattedExpirationDate = expirationDate.toISOString();

      // Create a new package detail entry with all columns
      const newPackageDetail = new PackageDetail({
        userid: authUser, // Assign authenticated user ID
        amount: pkgData?.monthlyPrice, // Assign amount
        membershipType: "monthly", // renew/upgrade/new
        type: "upgrade", // monthly, yearly
        fromPlanId: postData?.oldPkgId, // Previous plan ID oldPkgId
        toPlanId: postData?.newPkgId, // New plan ID
        expireDate: formattedExpirationDate, // Expiration date
        status: "Approved", // Status (active, pending, etc.)
      });

      await newPackageDetail.save(); // Save the new entry in the database

      res.json({
        status: "success",
        message: "User package has been updated successfully",
        pkgData: pkgData,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Server error occurred during registration.",
    });
  }
});

// router.post("/updateCommentSetting", async (req, res) => {
//   const postData = req.body;
//   // const userid = CleanHTMLData(CleanDBData(postData.userid));
//   const key = CleanHTMLData(CleanDBData(postData.key));
//   const value = CleanHTMLData(CleanDBData(postData.value));

//   try {
//     const authUser = await checkAuthorization(req, res);
//     if (authUser) {
//       const userSettings = await CommentSetting.findOne({ userid: authUser });

//       userSettings[key] = value;
//       await userSettings.save();

//       res.json({
//         status: "success",
//         message: `${key.charAt(0).toUpperCase() + key.slice(1)} is turned ${value === "true" ? "on" : "off"
//           }`,
//       });
//     }
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Something want wrong",
//     });
//   }
// });

router.post("/generalDetail", async (req, res) => {
  const postData = req.body;
  const hear = CleanHTMLData(CleanDBData(postData.hear));
  const industry = CleanHTMLData(CleanDBData(postData.industry));
  const values = CleanHTMLData(CleanDBData(postData.values));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const newUserGeneralDetail = new UserGeneralDetail({
        userid: authUser,
        industry: industry,
        marketingSource: hear,
        keyWords: values,
      });

      // Save the new data to the database
      await newUserGeneralDetail.save();

      return res.json({
        status: "success",
        message: "hear submit",
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

let browser, page;

async function launchBrowser() {
  // browser = await puppeteer.launch({ headless: false });
  browser = await puppeteer.launch({
    headless: false,
    // headless: false,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"], // Maximizes the browser window
    defaultViewport: null, // Ensures no viewport resizing
  });
  page = await browser.newPage();

  const cookiedb = await Setting.findOne({
    name: "cookie",
  });

  // Set LinkedIn cookie to maintain session
  await page.setCookie({
    name: "li_at",
    value: cookiedb.value,
    domain: ".www.linkedin.com",
    path: "/",
    secure: true,
    httpOnly: true,
    session: false,
    expires: 1769167122.700562,
  });

  console.log("Cookie set successfully.");

  // Go to LinkedIn profile page
  const url = "https://www.linkedin.com/in/me/";
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
}

// Keep Puppeteer alive
async function keepBrowserAlive() {
  // Always ensure Puppeteer is running
  if (!browser || !page) {
    await launchBrowser();
  }

  setInterval(async () => {
    try {
      // You can place periodic actions here (e.g., checking tasks, refreshing, etc.)
      console.log("Browser is still alive in User Route.");
    } catch (error) {
      console.error("Error while keeping the browser alive:", error);
      await launchBrowser(); // Restart browser in case of failure
    }
  }, 60000); // Every minute check
}

keepBrowserAlive();

// router.post("/linkedinLogin", async (req, res) => {
//   try {
//     console.log("Launching Puppeteer...");

//     // Launch Puppeteer with a visible browser window
//     const browser = await puppeteer.launch({
//       headless: false, // Opens the browser
//       args: ["--start-maximized"], // Maximizes the browser window
//       defaultViewport: null, // Prevents viewport resizing
//     });

//     const page = await browser.newPage();

//     console.log("Opening LinkedIn login page...");
//     await page.goto("https://www.linkedin.com/login", {
//       waitUntil: "networkidle2",
//       timeout: 60000,
//     });

//     console.log("Waiting for user to log in manually...");

//     // Wait for LinkedIn to redirect to the home page after login
//     await page.waitForNavigation({ waitUntil: "networkidle2" });

//     console.log("User logged in!");

//     // Get and log cookies after login
//     const cookies = await page.cookies();
//     console.log("LinkedIn Cookies:", cookies);

//     res.json({
//       status: "success",
//       message: "User logged into LinkedIn successfully",
//       cookies, // Return cookies if needed
//     });
//   } catch (error) {
//     console.error("Error in LinkedIn login:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Something went wrong",
//     });
//   }
// });

router.post("/linkedAccount", async (req, res) => {
  const postData = req.body;
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await LinkedAccount.find({
        userid: authUser,
        status: "active",
      });

      const ids = data.map(item => item._id);
      // console.log(ids);

      // Find all commentSettings where linkedAccountId matches the ids
      const linkedAccountToggle = await CommentSetting.find({ linkedAccountId: { $in: ids }, creatorid: "0" });
      // console.log("🚀 ~ router.post ~ linkedAccountToggle:", linkedAccountToggle);

      // Map commentSettings to the respective linked account
      data.forEach(entry => {
        // Modify the imageUrl if it's 'user.png'
        if (entry.imageUrl === 'user.png') {
          entry.imageUrl = `${backendURL}uploads/images/user.png`;
        }

        // Get the commentSettings for the current entry
        const entrySettings = linkedAccountToggle.filter(toggle => toggle.linkedAccountId.toString() === entry._id.toString());

        // Add the filtered settings to the entry
        entry.set("commentSettings", entrySettings[0], { strict: false });
      });

      return res.json({
        data,
        totalActiveAccounts: data.length,
        status: "success",
      });
    }
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
});

router.post("/linkedAccountDel", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await LinkedAccount.findOneAndUpdate(
        { _id: id },
        { status: "inactive" }
      );

      await User.findOneAndUpdate({ _id: authUser }, { cookieStatus: false });

      return res.json({
        status: "success",
        message: "Linked Account Deleted",
      });
    }
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
});

router.post("/linkedAccountPageStatus", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  const pageId = CleanHTMLData(CleanDBData(postData.pageId));
  const value = postData.value

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const linkedAccount = await LinkedAccount.findOne({ _id: id });
      let pageData = JSON.parse(linkedAccount.pageData);

      pageData = pageData.map(page => {
        // console.log("pages:", page)
        if (value == true) {
          // console.log("value true ===>", value, "page.pageId", pageId)
          // When value is true, set all statuses to false except the matched page
          return page._id === pageId ? { ...page, status: true } : { ...page, status: false };
        } else {
          // console.log("value false ==>", value, "page.pageId", pageId)
          // When value is false, only change the status of the matched page
          return page._id === pageId ? { ...page, status: false } : page;
        }
      });

      // console.log("pageData:", pageData)

      linkedAccount.pageData = JSON.stringify(pageData);

      await linkedAccount.save();

      return res.json({
        status: "success",
        message: "Linked Account Page Status Updated",
      });
    }
  } catch (error) {
    console.error(error.message);
    res.json({ message: "Something went Wrong", error });
  }
});

router.post("/linkedAccountForCreator", async (req, res) => {
  const postData = req.body;
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await LinkedAccount.find({
        userid: authUser,
        status: "active",
      });

      if (data && data.length > 0) {
        for (const account of data) {

          if (account.imageUrl === "user.png") {
            account.imageUrl = `${backendURL}uploads/images/${account.imageUrl}`;
          }

          const commentSetting = await CommentSetting.findOne({
            linkedAccountId: account._id,
            creatorid: "0",
          });
          // console.log("🚀 ~ router.post ~ commentSetting:", commentSetting)

          account.set("commentSettings", commentSetting, { strict: false });
        }
      }
      // console.log("🚀 ~ router.post ~ data:", data)
      return res.json({
        data,
        status: "success",
      });
    }
  } catch (error) {
    console.error("Error during fetching linked accounts and comment settings", error.message);
    res.status(500).json({ message: "Error during fetching linked accounts and comment settings", error });
  }
});

router.post("/findCreator", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.selectedAccountId));
  const creatorLink = CleanHTMLData(CleanDBData(postData.creatorLink));
  const linkedAccountPageId = CleanHTMLData(CleanDBData(postData.selectedAccountPageId));
  const toggles = JSON.parse(postData.toggles);

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      await page.goto(creatorLink, { waitUntil: "load", timeout: 60000 });
      // console.log("now evaluateing")

      const htmlSelector =
        "img.pv-top-card-profile-picture__image--show.evi-image.ember-view"; // define the HTML selector here
      await page.waitForSelector(htmlSelector);
      const tagLineHtmlSelector =
        '.text-body-medium[data-generated-suggestion-target*="urn:li:"]'; // define the HTML selector here
      const nameHtmlSelector = "h1.inline.t-24.v-align-middle.break-words"; // define the HTML selector here

      // Scrape the profile image URL
      const profileData = await page.evaluate(
        (htmlSelector, tagLineHtmlSelector, nameHtmlSelector) => {
          // LinkedIn profile image is usually inside an <img> tag with a specific class
          const imageUrl =
            document.querySelector(htmlSelector).src || "No image found";
          const tagLine =
            document
              .querySelector(tagLineHtmlSelector)
              .innerHTML.trim()
              .replace(/\s+/g, " ") || "No Tag Line found";
          const name =
            document
              .querySelector(nameHtmlSelector)
              .innerHTML.trim()
              .replace(/\s+/g, " ") || "No Name found";
          return { imageUrl, tagLine, name };
        },
        htmlSelector,
        tagLineHtmlSelector,
        nameHtmlSelector
      ); // pass htmlSelector as argument to evaluate

      console.log("Profile Image URL:", profileData);

      let newCreator

      if (linkedAccountPageId != "undefined") {
        newCreator = {
          linkedAccountId,
          linkedAccountPageId,
          url: creatorLink,
          imageUrl: profileData.imageUrl,
          tagLine: profileData.tagLine,
          name: profileData.name,
          status: "active",
        };
      } else {
        newCreator = {
          linkedAccountId,
          url: creatorLink,
          imageUrl: profileData.imageUrl,
          tagLine: profileData.tagLine,
          name: profileData.name,
          status: "active",
        };
      }

      // Find the creator by the linkedAccountId (or any other unique identifier) and update, or create a new one if it doesn't exist
      const updatedCreator = await Creator.findOneAndUpdate(
        { linkedAccountId, url: creatorLink }, // This is the condition to find an existing document
        { $set: newCreator }, // This is the new data to update with
        { upsert: true, new: true } // upsert: true will create a new document if one isn't found, new: true ensures you get the updated document
      );

      const linkedAccountIdCommentSetting = await CommentSetting.findOne({ linkedAccountId, creatorid: "0", });

      // console.log("🚀 ~ router.post ~ linkedAccountIdCommentSetting:", linkedAccountIdCommentSetting)

      // Check if the current comment setting is different from the new toggles values
      const isDifferent =
        linkedAccountIdCommentSetting?.emoji !== toggles.emoji ||
        linkedAccountIdCommentSetting?.hashtag !== toggles.hashtag ||
        linkedAccountIdCommentSetting?.lowercase !== toggles.lowercase ||
        linkedAccountIdCommentSetting?.exclamation !== toggles.exclamation ||
        linkedAccountIdCommentSetting?.author !== toggles.author;

      if (isDifferent) {
        // If the values are different, add a new comment setting
        // console.log("Toggles values:", toggles);

        const commentSetting = await CommentSetting.findOneAndUpdate(
          { linkedAccountId: linkedAccountId, creatorid: updatedCreator?._id },
          {
            creatorid: updatedCreator?._id, emoji: toggles.emoji, hashtag: toggles.hashtag,
            lowercase: toggles.lowercase, exclamation: toggles.exclamation,
            author: toggles.author, status: true
          },
          { upsert: true, new: true }
        );
      }

      res.json({
        status: "success",
        message: "Creator added",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      error: error,
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/getCreator", async (req, res) => {
  const postData = req.body;
  const selectedAccount = CleanHTMLData(CleanDBData(postData.selectedAccount));
  const linkedAccountPageId = CleanHTMLData(CleanDBData(postData.selectedAccountPage));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      let data;
      if (linkedAccountPageId != "undefined") {
        data = await Creator.find({
          linkedAccountId: selectedAccount,
          linkedAccountPageId,
          status: "active",
        });
      } else {
        data = await Creator.find({
          linkedAccountId: selectedAccount,
          status: "active",
        });
      }
      res.json({
        status: "success",
        data: data,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});

router.post("/deleteCreator", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  const selectedAccountPage = CleanHTMLData(CleanDBData(postData.selectedAccountPage));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      if (selectedAccountPage != "undefined") {
        await Creator.findByIdAndUpdate(
          { _id: id },
          { $unset: { linkedAccountPageId: 1 } }, // Removes the field
          { new: true }
        );
      }
      else {
        await Creator.findOneAndUpdate({ _id: id }, { status: "inactive" });
      }

      res.json({
        status: "success",
        message: "Creator deleted",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/findLinkedAccountSetting", async (req, res) => {
  const postData = req.body;
  const ids = postData.id
  // console.log("🚀 ~ router.post ~ ids:", ids)

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const linkedAccountToggle = await CommentSetting.find({ linkedAccountId: { $in: ids } })
      const linkedAccountToneGender = await LinkedAccountTone.find({ linkedAccountId: { $in: ids } })
      // console.log("🚀 ~ router.post ~ linkedAccountToggle:", linkedAccountToggle)

      res.json({
        status: "success",
        linkedAccountToggle,
        linkedAccountToneGender
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleUpdateCommentSettingLinkedAccount", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccount));
  const key = CleanHTMLData(CleanDBData(postData.key));
  const value = CleanHTMLData(CleanDBData(postData.value));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const updatedUserSettings = await CommentSetting.findOneAndUpdate(
        { linkedAccountId }, // find the document by linkedAccountId
        { $set: { [key]: value } }, // update the specified key with the new value
        { new: true } // return the updated document
      );
      res.json({
        status: "success",
        message: `${key.charAt(0).toUpperCase() + key.slice(1)} is turned ${value === "true" ? "on" : "off"}`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleGetCommentSettingCreatorAccount", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      let creatorSettings = await CommentSetting.findOne({ creatorid: id });

      if (creatorSettings === null) {
        creatorSettings = await CommentSetting.findOne({ linkedAccountId });
      }

      // console.log("🚀 ~ router.post ~ creatorSettings:", creatorSettings)

      res.json({
        status: "success",
        data: creatorSettings,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleUpdateCommentSettingCreatorAccount", async (req, res) => {
  const postData = req.body;
  const creatorAccount = CleanHTMLData(CleanDBData(postData.creatorAccount));
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));
  const toggles = JSON.parse(postData.toggles);

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const commentSetting = await CommentSetting.findOneAndUpdate(
        { linkedAccountId: linkedAccountId, creatorid: creatorAccount },
        {
          emoji: toggles.emoji, hashtag: toggles.hashtag,
          lowercase: toggles.lowercase, exclamation: toggles.exclamation,
          author: toggles.author, status: true
        },
        { upsert: true, new: true }
      );

      res.json({
        status: "success",
        message: `Setting updated`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/importPageData", async (req, res) => {
  const postData = req.body;
  const selectedAccount = CleanHTMLData(CleanDBData(postData.selectedAccount));
  const linkedAccountPageId = CleanHTMLData(CleanDBData(postData.selectedAccountPage));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const updatedData = await Creator.updateMany(
        { linkedAccountId: selectedAccount, status: "active", },
        { $set: { linkedAccountPageId, }, }
      );

      res.json({
        status: "success",
        message: `Setting updated`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

// tone
router.post("/linkedAccountGetToneAllByUserId", async (req, res) => {
  const postData = req.body;
  const userId = CleanHTMLData(CleanDBData(postData.userId));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {

      const LinkedAccountData = await LinkedAccount.find({ userid: authUser, status: "active" });
      const LinkedAccountToneData = await LinkedAccountTone.find({ userid: authUser });
      // console.log("🚀 ~ router.post ~ LinkedAccountData:", LinkedAccountData)

      let linkedAccountPageTones = []

      for (const entry of LinkedAccountData) {
        if (entry.imageUrl === 'user.png') {
          entry.imageUrl = `${backendURL}uploads/images/user.png`;
        }
        // if(Array.isArray(JSON.parse(entry.pageData)) && entry.pageData !== 'No company found'){
        if (entry.pageData && entry.pageData !== 'No company found') {
          let parseData = JSON.parse(entry.pageData)
          // console.log("🚀 ~ router.post ~ parseData:", parseData)
          // Extract the _id values from your input data
          const linkedAccountIds = parseData.map(item => item._id);

          linkedAccountPageTones = await LinkedAccountTone.find({
            linkedAccountPageId: { $in: linkedAccountIds }
          });
        }
      }

      res.json({
        status: "success",
        LinkedAccountData,
        LinkedAccountToneData,
        linkedAccountPageTones
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});

router.post("/linkedAccountUpdateTone", async (req, res) => {
  const postData = req.body;
  const title = CleanHTMLData(CleanDBData(postData.title));
  const selectedValue = CleanHTMLData(CleanDBData(postData.selectedValue));
  const linkedAccount = CleanHTMLData(CleanDBData(postData.linkedAccount));
  const linkedAccountPageTone = CleanHTMLData(CleanDBData(postData.linkedAccountPageTone));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      if (linkedAccountPageTone == "null") {
        // console.log('profile tone')
        await LinkedAccountTone.findOneAndUpdate(
          { linkedAccountId: linkedAccount },
          { $set: { [title]: selectedValue } },  // Dynamic field update
          { new: true }  // Return the updated document
        );
      } else {
        // console.log('page tone')
        await LinkedAccountTone.findOneAndUpdate(
          { linkedAccountPageId: linkedAccountPageTone },
          { $set: { [title]: selectedValue } },  // Dynamic field update
          { new: true }  // Return the updated document
        );
      }
      res.json({
        status: "success",
        message: `${title.charAt(0).toUpperCase() + title.slice(1)} updated successfully`
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/linkedAccountGenderChange", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));
  const value = CleanHTMLData(CleanDBData(postData.value));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {

      await LinkedAccountTone.findOneAndUpdate(
        { linkedAccountId: linkedAccountId },
        { gender: value },
        { new: true, upsert: true }
      );

      res.json({
        status: "success",
        message: 'Gender Updated successfully'
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/images";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Create directory if not exists
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const newFileName = `image_${Date.now()}${fileExt}`;
    cb(null, newFileName);
  }
});

// Multer Upload Middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, JPG, and WEBP images are allowed"));
    }
    cb(null, true);
  }
});

router.post("/userinfoUpdate", upload.single("image"), async (req, res) => {
  const postData = req.body;
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));
  const email = CleanHTMLData(CleanDBData(postData.email));
  const contact = CleanHTMLData(CleanDBData(postData.contact));
  const address1 = CleanHTMLData(CleanDBData(postData.address1));
  const address2 = CleanHTMLData(CleanDBData(postData.address2));
  const city = CleanHTMLData(CleanDBData(postData.city));
  const country = CleanHTMLData(CleanDBData(postData.country));
  const bio = CleanHTMLData(CleanDBData(postData.bio));

  // Handle Image Upload
  let imagePath = "";
  if (req.file) {
    // Store the filename with the path
    imagePath = `${req.file.filename}`;
  } else if (postData.image) {
    // If no new file but existing image path provided
    imagePath = postData.image.split("/").pop();
  }

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {

      const updatedUser = await User.findByIdAndUpdate(
        authUser, // Assuming `authUser` contains the user's ID
        {
          firstName, lastName, email, contact, address1, address2, city,
          bio, country, image: imagePath
        },
        { new: true, runValidators: true }
      );

      res.json({
        status: "success",
        message: "Profile Updated"
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});



router.post("/updatedPasswordAndSetting", async (req, res) => {
  const postData = req.body;
  console.log("🚀 ~ router.post ~ postData:", postData)
  const currentPassword = CleanHTMLData(CleanDBData(postData.currentPassword));
  const newPassword = CleanHTMLData(CleanDBData(postData.newPassword));
  const has2FA = CleanHTMLData(CleanDBData(postData.has2FA));
  const allowUpdate = CleanHTMLData(CleanDBData(postData.allowUpdate));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const user = await User.findById(authUser);

      const decryptedPassword = crypto.AES.decrypt(user.password, encryptionKey).toString(crypto.enc.Utf8);
      const passwordMatched = await bcrypt.compare(currentPassword, decryptedPassword);
      if (!passwordMatched) {
        return res.json({
          status: "error",
          message: "The current password you entered is incorrect.",
        });
      }

      // Generate hashed and encrypted password
      const salt = bcrypt.genSaltSync(12);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      const encryptedPassword = crypto.AES.encrypt(hashedPassword, encryptionKey).toString();

      await User.findOneAndUpdate({ _id: authUser }, { password: encryptedPassword });

      res.json({
        status: "success",
        message: "Your password and settings have been successfully updated."
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});










// keyword
router.post("/addKeyword", async (req, res) => {
  const postData = req.body;
  const keyword = CleanHTMLData(CleanDBData(postData.keyword));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const keywordData = new Keyword({
        userid: authUser,
        keyword: keyword,
        status: "active",
      });

      await keywordData.save();

      res.json({
        status: "success",
        message: "Keyword added",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/getKeyword", async (req, res) => {
  const postData = req.body;
  // const userid = CleanHTMLData(CleanDBData(postData.userid));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await Keyword.find({ userid: authUser, status: "active" });

      res.json({
        status: "success",
        data: data,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/deleteKeyword", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      await Keyword.findOneAndUpdate({ _id: id }, { status: "inactive" });

      res.json({
        status: "success",
        message: "Keyword deleted",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/findKeywordSetting", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const CreatorData = await Keyword.findById(id);
      let data;
      data = await CommentSetting.findOne({ keywordid: id });
      // console.log("🚀 ~ router.post ~ data:", data)

      if (data === null) {
        data = await CommentSetting.findOne({ creatorid: "0" });
      }

      res.json({
        status: "success",
        data: { data, CreatorData },
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleUpdateCommentSettingKeyword", async (req, res) => {
  const postData = req.body;
  const keywordid = CleanHTMLData(CleanDBData(postData.creatorId));
  const key = CleanHTMLData(CleanDBData(postData.key));
  const value = CleanHTMLData(CleanDBData(postData.value));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      let userSettings = await CommentSetting.findOne({ keywordid });
      if (!userSettings) {
        // If the record does not exist, create it with the provided key-value
        // and set all other fields to false by default
        const generalSetting = await CommentSetting.findOne({ creatorid: "0" });
        // Initialize new settings with defaults or general settings
        const newSettings = {
          keywordid,
          userid: authUser,
          emojis: generalSetting?.emojis || false,
          hashtag: generalSetting?.hashtag || false,
          lowercase: generalSetting?.lowercase || false,
          exclamation: generalSetting?.exclamation || false,
        };
        newSettings[key] = value; // Set the provided field value
        userSettings = new CommentSetting(newSettings);
      } else {
        // If the record exists, update only the specified field
        userSettings[key] = value;
      }

      await userSettings.save();

      res.json({
        status: "success",
        message: `${key.charAt(0).toUpperCase() + key.slice(1)} is turned ${value === "true" ? "on" : "off"
          }`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});








// password
router.post("/forgotpassword", async (req, res) => {
  const postData = req.body;
  try {
    const email = CleanHTMLData(CleanDBData(postData.email));
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.json({ status: "error", message: "User not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.forgotpasswordotp = otp;
    await user.save();
    return res.json({
      status: "success",
      message:
        "An email has been sent to your registered email with the OTP. Please check your inbox.",
      otp,
    });
  } catch (error) {
    console.error("Error OTP generated", error.message);
    res.json({ message: "Error OTP generated", error });
  }
});

router.post("/checkforgotpasswordotp", async (req, res) => {
  const postData = req.body;
  try {
    const otp = CleanHTMLData(
      CleanDBData(Object.values(postData).slice(0, -1).join(""))
    );
    const email = CleanHTMLData(CleanDBData(postData.email));
    const Otp = await User.findOne({ forgotpasswordotp: otp });
    const Email = await User.findOne({ email: email });
    if (!Otp) {
      return res.json({ status: "error", message: "Invalid otp" });
    }
    if (!Email) {
      return res.json({ status: "error", message: "Invalid email" });
    }
    return res.json({
      status: "success",
      message: "OTP matched successfully",
    });
  } catch (error) {
    console.error("Invalid OTP", error.message);
    res.json({ message: "Invalid OTP", error });
  }
});

router.post("/changeforgotpassword", async (req, res) => {
  const postData = req.body;
  const email = CleanHTMLData(CleanDBData(postData.email));
  const password = CleanHTMLData(CleanDBData(postData.password));
  try {
    const salt = bcrypt.genSaltSync(12);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const encryptedPassword = crypto.AES.encrypt(
      hashedPassword,
      encryptionKey
    ).toString();

    const Email = await User.findOne({ email: email });
    if (!Email) {
      return res.json({ status: "error", message: "Invalid email" });
    }
    await User.updateOne(
      { email: email },
      { $set: { password: encryptedPassword } }
    );
    return res.json({
      status: "success",
      message: "Password has been changed successfully",
    });
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
});




// function for delay
function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

router.post("/cronjobForCreator", async (req, res) => {
  const postData = req.body;
  const creatorid = CleanHTMLData(CleanDBData(postData.creatorId));

  try {
    const users = await User.find();
    console.log("🚀 ~ router.post ~ users:", users);
    for (const user of users) {
      const userid = user._id.toString();
      const creators = await Creator.find({ userid: userid, status: "active" });
      console.log("🚀 ~ router.post ~ creators:", creators);
      for (const creator of creators) {
        const profileUrl = creator.url;
        const profileId = creator._id;
        // const profileName = creator.name
        // console.log("🚀 ~ router.post ~ profileName:", profileName)
        // console.log("🚀 ~ router.post ~ profileUrl:", profileUrl)

        await page.goto(profileUrl, { waitUntil: "load", timeout: 60000 });
        // find the recent post and click on the comment button and open new page
        await page.waitForSelector("div.feed-shared-update-list-carousel");
        await page.evaluate(() => {
          document
            .querySelectorAll("div.feed-shared-update-list-carousel")
            .forEach((feedUpdate) => {
              const ulTag = feedUpdate.querySelector("ul");
              if (!ulTag) return;

              const commentButton = ulTag.querySelector(
                'li button[aria-label="Comment"]'
              );
              if (commentButton) commentButton.click();
            });
        });
        // find the comment input box and type the comment
        await page.waitForSelector("main");
        await page.waitForSelector(
          "div.update-components-text.update-components-update-v2__commentary"
        );

        const postData = await page.evaluate(() => {
          // Select the first matching element
          return (
            document
              .querySelector(
                "div.update-components-text.update-components-update-v2__commentary"
              )
              .textContent.trim() || "No post found"
          );
        });
        console.log("🚀 ~ PostData:", postData);

        const postUrl = page.url(); // Get the current URL
        console.log("Post URL:", postUrl);

        const checkPostUrl = await CommentDetail.findOne({
          userid,
          creatorid: profileId,
          postUrl,
        });
        console.log("🚀 ~ router.post ~ checkPostUrl:", checkPostUrl);

        if (checkPostUrl === null) {
          console.log("previous commented not found");

          let commentSetting = await CommentSetting.findOne({
            creatorid: profileId,
          });
          if (commentSetting === null) {
            commentSetting = await CommentSetting.findOne({ creatorid: "0" });
          }
          // console.log("🚀 ~ router.post ~ commentSetting:", commentSetting)

          // Find and log the settings that are true
          const trueSettings = [
            "emojis",
            "hashtag",
            "lowercase",
            "exclamation",
          ].filter((setting) => commentSetting[setting] === true);

          if (trueSettings.length > 0) {
            console.log(
              `The settings with true values are: ${trueSettings.join(", ")}`
            );
          } else {
            console.log("No setting is true.");
          }

          let rules = `Generate a comment for this post: "${postData}"
					*Rules:*
					- Less than 500 characters`;

          const settingRules = {
            emojis: "Use emojis",
            hashtag: "Use hashtags",
            lowercase: "Use lowercase letters",
            exclamation: "Use exclamation marks!",
          };

          // Loop through trueSettings and add corresponding rules dynamically
          trueSettings.forEach((setting, index) => {
            if (settingRules[setting]) {
              rules += `\n- ${settingRules[setting]}`;
            }
          });

          console.log(rules);

          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional LinkedIn user who provides respectful, thoughtful, and engaging comments on posts.",
              },
              {
                role: "user",
                content: rules,
              },
            ],
            store: true,
          });

          const commentText = completion.choices[0].message.content;
          console.log("response from chatgpt", commentText);

          // const commentText = "Good post!";
          const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
          // Wait for the comment box to appear
          await page.waitForSelector(commentBoxSelector, {
            visible: true,
            timeout: 10000,
          });
          // Focus on the comment box
          await page.focus(commentBoxSelector);
          // Type the comment
          await page.type(commentBoxSelector, commentText);
          console.log("Comment typed successfully.");
          const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
          // Ensure the Comment button is enabled and visible
          await page.waitForSelector(commentButtonSelector, { visible: true });
          // Click on the Comment button
          await page.click(commentButtonSelector);
          console.log("Comment posted successfully.");

          await CommentDetail.create({
            userid,
            creatorid: profileId,
            comment: commentText,
            postData,
            postUrl,
          });

          await delay(2000);
        } else {
          console.log("commented found");
        }
      }
    }

    res.json({
      status: "success",
      message: `Cron job is executed`,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/cronjobForTagSearch", async (req, res) => {
  const postData = req.body;
  const creatorid = CleanHTMLData(CleanDBData(postData.creatorId));

  try {
    const users = await User.find();
    console.log("🚀 ~ router.post ~ users:", users);
    for (const user of users) {
      const userid = user._id.toString();
      const Keywords = await Keyword.find({ userid: userid, status: "active" });
      console.log("🚀 ~ router.post ~ Keywords:", Keywords);

      const profileUrl = "https://www.linkedin.com/in/floria-doe-2aab36348/";
      await page.goto(profileUrl, { waitUntil: "load", timeout: 60000 });

      for (const keyword of Keywords) {
        const userid = keyword.userid;
        const userKeyword = keyword.keyword;
        console.log("🚀 ~ router.post ~ userKeyword:", userKeyword);

        const inputSelector = "input.search-global-typeahead__input";
        // Step 1: Click on the search input field
        await page.click(inputSelector);
        // Step 2: Wait for the input field to appear
        await page.waitForSelector(inputSelector, { visible: true });
        // Step 3: Clear the input field
        await page.evaluate((selector) => {
          document.querySelector(selector).value = "";
        }, inputSelector);
        // Define the tag to search (e.g., "react posts")
        const tagToSearch = `${userKeyword} posts`;
        // Step 4: Type the search term into the input field
        await page.type(inputSelector, tagToSearch);
        // Step 4: Press Enter to submit the search
        await page.keyboard.press("Enter");
        // Wait for the search results page to load (optional)
        await page.waitForNavigation({ waitUntil: "load", timeout: 60000 });
        // Optionally, you can do further actions or capture the result here
        console.log("Keyword searched");
        await page.waitForSelector(
          'ul[role="list"] li.search-results__search-feed-update',
          { visible: true }
        );
        // Select all posts
        const recentPostsElement = await page.$$(
          'ul[role="list"] li.search-results__search-feed-update'
        );
        const firstPost = recentPostsElement[0];
        if (firstPost) {
          // Locate the "Comment" button within the first post
          const commentButton = await firstPost.$(
            `button[aria-label="Comment"]`
          );
          if (commentButton) {
            // Click the "Comment" button
            await commentButton.click();

            const commentText = "Good post!";
            const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
            // Wait for the comment box to appear
            await page.waitForSelector(commentBoxSelector, {
              visible: true,
              timeout: 10000,
            });
            // Focus on the comment box
            await page.focus(commentBoxSelector);
            // Type the comment
            await page.type(commentBoxSelector, commentText);
            console.log("Comment typed successfully.");

            const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
            // Ensure the Comment button is enabled and visible
            await page.waitForSelector(commentButtonSelector, {
              visible: true,
            });
            await delay(2000);
            // Click on the Comment button
            await page.click(commentButtonSelector);
            await delay(2000);

            console.log("Comment submitted successfully!");
          } else {
            console.error("Comment button not found in the first post.");
          }
        } else {
          console.error("No posts found to comment on.");
        }
      }
    }

    res.json({
      status: "success",
      message: `Cron job is executed`,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

// router.post("/cronjobToSinglePostCommentURLBase", async (req, res) => {
//   const postData = req.body;
//   const PostUrl = CleanHTMLData(CleanDBData(postData.url));

//   try {
//     await page.goto(PostUrl, { waitUntil: "load", timeout: 60000 });

//     // find the comment input box and type the comment
//     await page.waitForSelector("main");
//     await page.waitForSelector(
//       "div.update-components-text.update-components-update-v2__commentary"
//     );

// const postData = await page.evaluate(() => {
//   // Select the first matching element
//   return (
//     document
//       .querySelector(
//         "div.update-components-text.update-components-update-v2__commentary"
//       )
//       .textContent.trim() || "No post found"
//   );
// });
// console.log("🚀 ~ PostData:", postData);


//     const commentText = "Hello World";

//     // const commentText = "Good post!";
//     const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
//     // Wait for the comment box to appear
//     await page.waitForSelector(commentBoxSelector, {
//       visible: true,
//       timeout: 10000,
//     });
//     // Focus on the comment box
//     await page.focus(commentBoxSelector);
//     // Type the comment
//     await page.type(commentBoxSelector, commentText);
//     console.log("Comment typed successfully.");
//     const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
//     // Ensure the Comment button is enabled and visible
//     await page.waitForSelector(commentButtonSelector, { visible: true });
//     // Click on the Comment button
//     await page.click(commentButtonSelector);
//     console.log("Comment posted successfully.");





//     res.json({
//       status: "success",
//       message: `Cron job is executed`,
//     });
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Something want wrong",
//     });
//   }
// });

router.post("/cronjobToSinglePostReactAndComment", async (req, res) => {
  const PostUrl = "https://www.linkedin.com/posts/faisal-akhtar-663650296_git-code-devlife-activity-7298535715586347008-pB7-?utm_source=share&utm_medium=member_desktop&rcm=ACoAAEekgKsBrmFcR47JU7h_Z3yCBkb1MWaWAqQ"
  const comment = "Great post!";
  const reactionType = "Support";

  try {
    await page.goto(PostUrl, { waitUntil: "load", timeout: 60000 });

    // Wait for the post container
    await page.waitForSelector("main");
    await page.waitForSelector("div.update-components-text.update-components-update-v2__commentary");

    console.log("Navigated to post successfully.");

    const postData = await page.evaluate(() => {
      // Select the first matching element
      return ( document.querySelector("div.update-components-text.update-components-update-v2__commentary").textContent.trim() || "No post found"
      );});

    console.log("🚀 ~ PostData:", postData);

    // Commenting on the post (if provided)
    if (comment) {
      const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
      await page.waitForSelector(commentBoxSelector, { visible: true, timeout: 10000 });
      await page.focus(commentBoxSelector);
      await page.type(commentBoxSelector, comment);
      console.log("Comment typed successfully.");

      const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
      await page.waitForSelector(commentButtonSelector, { visible: true });
      await page.click(commentButtonSelector);
      console.log("Comment posted successfully.");
    }

    // Reacting to the post (if provided)
    if (reactionType) {
      const reactionButtonSelector = `button.react-button__trigger`;

      // Hover over the reaction button to reveal the options
      await page.waitForSelector(reactionButtonSelector, { visible: true });
      await page.hover(reactionButtonSelector);
      console.log("Hovered over the reaction button.");

      // Define reaction selector based on type
      const reactionSelectors = {
        like: "button[aria-label='React Like']",
        celebrate: "button[aria-label='React Celebrate']",
        support: "button[aria-label='React Support']",
        love: "button[aria-label='React Love']",
        insightful: "button[aria-label='React Insightful']",
        funny: "button[aria-label='React Funny']",
      };

      if (reactionSelectors[reactionType.toLowerCase()]) {
        // Wait for reaction options to appear
        await page.waitForSelector(reactionSelectors[reactionType.toLowerCase()], { visible: true });
        // Click on the desired reaction
        await page.click(reactionSelectors[reactionType.toLowerCase()]);
        console.log(`Reaction '${reactionType}' added successfully.`);
      } else {
        console.log("Invalid reaction type provided.");
      }
    }

    res.json({
      status: "success",
      message: `Cron job executed: ${reactionType ? `Reacted with ${reactionType}.` : ""} ${comment ? "Comment added." : ""}`,
    });
  } catch (error) {
    console.error("Error:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});



router.post("/addPackage", async (req, res) => {
  try {
    // const { name, price, commentLimit, accountLimit, profileLimit, pageLimit, bothActive, status } = req.body;
    const name = "Custom";
    const price = "150";
    const commentLimit = "50";
    const accountLimit = "5";
    const profileLimit = "5";
    const creatorLimit = "50";
    const pageLimit = "5";
    const bothActive = false;
    const status = "active";
    const type = "custom";

    // Check if all required fields are provided
    if (
      !name ||
      !price ||
      !commentLimit ||
      !accountLimit ||
      !profileLimit ||
      !pageLimit ||
      bothActive === undefined ||
      !status ||
      !type
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create a new Package instance
    const newPackage = new Package({
      name,
      price,
      commentLimit,
      accountLimit,
      profileLimit,
      pageLimit,
      bothActive,
      creatorLimit,
      status,
      type,
    });

    // Save the new package to the database
    await newPackage.save();

    return res
      .status(201)
      .json({ message: "Package added successfully", data: newPackage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/addSetting", async (req, res) => {
  try {
    const name = "cookie";
    const value =
      "AQEDASIlnxkE1eKlAAABlUGUFy0AAAGVZaCbLU0Ae0fu27eN4gtJgPxG9bMFeW81O0_oZc7rqGpwKipW1zOsvYdFrGJK1uRIxAeBCKq5cHJZU-VBtxGnzQtLJ6biz4XXn2a_Oa_eWxoNXoFqvQnAnQuI";
    const setting = new Setting({ name, value });
    // Save the setting to the database
    await setting.save();
    return res.status(201).json({ message: "Setting added successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post('/linked-account-tone-one-time', async (req, res) => {
  try {
    const userid = "0";
    const linkedAccountId = "0";
    const tone = "friendly";  // Hardcoded tone, e.g., 'professional', 'friendly', etc.
    const formalityLevel = "semiFormal";  // Hardcoded formality level, e.g., 'formal', 'semiFormal', etc.
    const questionsFrequency = "sometimes";  // Hardcoded question frequency, e.g., 'frequently', 'sometimes', etc.
    const commentsLength = "medium";  // Hardcoded comment length, e.g., 'short', 'medium', etc.
    const personality = "optimistic";  // Hardcoded personality, e.g., 'analytical', 'optimistic', etc.

    // Create a new instance of the LinkedAccountTone model
    const newLinkedAccountTone = new LinkedAccountTone({
      userid,
      linkedAccountId,
      tone,
      formalityLevel,
      questionsFrequency,
      commentsLength,
      personality,
    });

    // Save the data to MongoDB
    const savedData = await newLinkedAccountTone.save();

    // Send response
    res.status(201).json({ message: 'Data saved successfully', data: savedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving data', error });
  }
});

(module.exports = router), browser, { page };
