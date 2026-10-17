import { Router } from "express";
import protect from "../middleware/auth.js";
import { refreshSubscription, consumeQuota, releaseQuota } from "../Services/subscriptionService.js";


const router = Router();
import application from "../Model/Application.js";

router.post("/", protect, async (req, res) => {
try {
    await refreshSubscription(req.user);

    const allowed = await consumeQuota(req.user._id);
    if (!allowed) {
      return res.status(403).json({
        error: "You've used all your internship applications for this billing cycle. Upgrade your plan or wait for your quota to renew.",
        code: "QUOTA_EXHAUSTED",
      });
    }

    try {
      const data = await new application({
        company: req.body.company,
        category: req.body.category,
        coverLetter: req.body.coverLetter,
        // Identity comes from the verified token, not the request body.
        user: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          photo: req.user.photo,
        },
        Application: req.body.Application,
        body: req.body.body,
      }).save();
      return res.send(data);
    } catch (saveError) {
      await releaseQuota(req.user._id); // failed save shouldn't cost the user an application
      throw saveError;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not submit application" });
  }
});
router.get("/", async (req, res) => {
  try {
    const data = await application.find();
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await application.findById(id);
    if (!data) {
      res.status(404).json({ error: "application not found" });
    }
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  let status;
  if (action === "accepted") {
    status = "accepted";
  } else if (action === "rejected") {
    status = "rejected";
  } else {
    res.status(404).json({ error: "Invalid action" });
    return;
  }
  try {
    const updateapplication = await application.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!updateapplication) {
      res.status(404).json({ error: "Not able to update the application" });
      return;
    }
    res.status(200).json({ sucess: true, data: updateapplication });
  } catch (error) {
    res.status(500).json({ error: "internal server error" });
  }
});
export default router;
