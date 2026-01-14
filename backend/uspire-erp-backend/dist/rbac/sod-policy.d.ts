export interface SoDCheckContext {
    action: string;
    actorUserId: string;
    entityType: string;
    entityId: string;
    createdById?: string;
    approvedById?: string;
    postedById?: string;
    submittedById?: string;
    reviewedById?: string;
    reversalInitiatedById?: string;
    checklistCompletedByIds?: string[];
    allowSelfPosting?: boolean;
}
export declare function evaluateSoD(ctx: SoDCheckContext): {
    allowed: boolean;
    reason?: string;
    ruleCode?: string;
};
