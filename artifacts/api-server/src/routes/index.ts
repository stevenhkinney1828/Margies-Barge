import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bargeRouter from "./barge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bargeRouter);

export default router;
