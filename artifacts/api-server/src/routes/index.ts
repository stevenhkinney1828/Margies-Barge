import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bargeRouter from "./barge";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bargeRouter);
router.use(storageRouter);

export default router;
