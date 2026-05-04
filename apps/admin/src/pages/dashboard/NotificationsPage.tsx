import { motion } from "framer-motion";
import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function NotificationsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-[calc(100vh-80px)]"
    >
      <PremiumFeaturePlaceholder 
        title="Admin Notifications Center"
        description="The advanced notification center, complete with bulk user messaging and detailed audience targeting, is an advanced capability exclusive to the premium source codebase."
        features={[
          "Centralized dashboard for all system alerts",
          "One-click bulk messaging to targeted user cohorts",
          "Rich-text notification formatting with action URLs",
          "Notification delivery and read-receipt statistics"
        ]}
      />
    </motion.div>
  );
}
