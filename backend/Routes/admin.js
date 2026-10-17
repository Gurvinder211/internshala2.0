import { Router } from "express";
const router = Router();
const adminuser = "admin";
const adminpass = "admin";

router.post("/adminlogin", (req, res) => {
  const { username, password } = req.body;
  if (username === adminuser && password === adminpass) {
    res.send("admin is here");
  } else {
    res.send(401).send("unauthrized");
  }
});
export default router;
