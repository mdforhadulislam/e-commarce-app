import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Reviews</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer reviews and feedback
          </p>
        </div>
      </div>
      
      <PremiumFeaturePlaceholder
        title="Review Moderation"
        description="Comprehensive review moderation streams are exceptionally powerful tools to manage user feedback. Approving, rejecting, and responding to product reviews are strictly reserved for the premium source code."
        features={[
          "Pending and Approved review streams",
          "One-click review approvals and rejections",
          "Detailed user feedback analysis",
          "Automated moderation tools",
        ]}
      />
    </div>
  );
}
