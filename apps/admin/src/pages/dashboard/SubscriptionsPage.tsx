import { motion } from "framer-motion";
import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function SubscriptionsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-[calc(100vh-80px)]"
    >
      <PremiumFeaturePlaceholder 
        title="Newsletter & Subscribers Management"
        description="Managing storefront newsletter subscribers, broadcasting marketing emails, and generating subscriber-only discount codes is an advanced CRM capability exclusive to the premium source codebase."
        features={[
          "Exportable database of all active newsletter subscribers",
          "One-click promotional mass-email dispatching",
          "Automated double opt-in verification workflows",
          "Segmentation and engagement tracking (open/click rates)"
        ]}
      />
    </motion.div>
  );
}
