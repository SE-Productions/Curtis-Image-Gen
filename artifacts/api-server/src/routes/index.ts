import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studioRouter from "./studio";
import contentWorkflowRouter from "./content-workflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studioRouter);
router.use(contentWorkflowRouter);

export default router;
