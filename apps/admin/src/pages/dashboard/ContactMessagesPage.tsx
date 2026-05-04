import { motion } from "framer-motion";
import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function ContactMessagesPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-[calc(100vh-80px)]"
    >
      <PremiumFeaturePlaceholder 
        title="Contact Messages Inbox"
        description="Reading, organizing, and replying to customer contact messages directly from the dashboard is an advanced CRM capability exclusive to the premium source codebase."
        features={[
          "Unified inbox for all storefront inquiries",
          "Sort, filter, and archive customer messages",
          "Direct reply functionality directly from dashboard",
          "Automated ticket assignment and tracking"
        ]}
      />
    </motion.div>
  );
}
