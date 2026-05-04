import { motion } from "framer-motion";
import PremiumFeaturePlaceholder from "@/components/common/PremiumFeaturePlaceholder";

export default function PurchasedItemsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-[calc(100vh-80px)]"
    >
      <PremiumFeaturePlaceholder 
        title="Purchased Items History"
        description="Detailed historical logs of all received inventory, landed cost tracking, and unit economics analysis are advanced capabilities exclusive to the premium source codebase."
        features={[
          "Historical receiving logs and vendor performance",
          "Granular landed cost and unit economics tracking",
          "Searchable database of all past order intakes",
          "Automated discrepancy reporting for missing items"
        ]}
      />
    </motion.div>
  );
}
