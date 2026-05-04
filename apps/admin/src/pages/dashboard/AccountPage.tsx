import { motion } from "framer-motion";
import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function AccountPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-[calc(100vh-80px)]"
    >
      <PremiumFeaturePlaceholder 
        title="Advanced Analytics & Account Overview"
        description="Comprehensive e-commerce analytics, inventory alerts, and real-time revenue tracking are advanced capabilities exclusive to the premium source codebase."
        features={[
          "Historical revenue & order volume charts",
          "Automated Low-Stock and Out-of-Stock alerts",
          "Best-selling product performance tables",
          "Order status breakdown visualizations"
        ]}
      />
    </motion.div>
  );
}
