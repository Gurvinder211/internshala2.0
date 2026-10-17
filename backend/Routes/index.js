import { Router } from "express";
const router = Router();
import admin from "./admin.js";
import intern from "./internship.js";
import job from "./job.js";
import application from "./application.js";
import language from './language.js';
import auth from './auth.js';
import user from './user.js';
import passwordReset from './passwordReset.js';
import subscription from './subscription.js';
import resume from './resume.js';
import post from './post.js';
import feed from './feed.js';
import social from './social.js';
import notification from './notification.js';



router.use('/resume', resume);
router.use("/admin", admin);
router.use("/internship", intern);
router.use("/job", job);
router.use("/subscription", subscription);
router.use("/auth", auth);
router.use("/user", user);
router.use("/application", application);
router.use("/language", language);
router.use("/password-reset", passwordReset);
router.use('/post', post);
router.use('/feed', feed);
router.use('/social', social);
router.use('/notification', notification);



export default router;
