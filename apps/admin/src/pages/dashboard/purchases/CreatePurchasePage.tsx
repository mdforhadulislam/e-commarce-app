import { motion } from "framer-motion";
import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function CreatePurchasePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-[calc(100vh-80px)]"
    >
      <PremiumFeaturePlaceholder 
        title="Advanced Purchase Requisitions"
        description="Comprehensive purchase requisitions, supplier management, and automated inventory restocking are advanced capabilities exclusive to the premium source codebase."
        features={[
          "End-to-end purchase order lifecycle tracking",
          "Integrated supplier database and communication",
          "Automated cost calculation and profit margin analysis",
          "Direct inventory synchronization upon receipt"
        ]}
      />
    </motion.div>
  );
}
