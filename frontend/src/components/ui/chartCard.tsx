import { motion } from "framer-motion";
import { useState } from "react";
import { Info, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ChartCard = ({ loading, children, details }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="relative w-full h-80 perspective-1000">
      <motion.div
        className="relative w-full h-full preserve-3d cursor-pointer"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
        whileHover={{
          scale: 1.02,
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(255,255,255,0.8) 100%)",
          borderRadius: "1rem",
        }}
      >
        {/* Front Side */}
        <div className="absolute inset-0 w-full h-full backface-hidden  dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col transition-all duration-300 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(true);
            }}
            className="absolute top-3 right-3 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors z-10"
          >
            <Info className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
          </button>
          {loading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : (
            children
          )}
        </div>

        {/* Back Side */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-xl shadow-lg border border-blue-200 dark:border-blue-700 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {details.title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(false);
              }}
              className="p-2 rounded-full bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-blue-700 dark:text-blue-300" />
            </button>
          </div>

          {/* Scrollable Info Section */}
          <div className="space-y-4 text-sm text-blue-800 dark:text-blue-200 overflow-y-auto scrollbar-hide flex-1">
            <div>
              <h4 className="font-medium mb-2">Description:</h4>
              <p className="leading-relaxed">{details.description}</p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Metrics:</h4>
              <ul className="space-y-1">
                {details.metrics.map((metric, index) => (
                  <li key={index} className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    {metric}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Insights:</h4>
              <p className="leading-relaxed text-blue-700 dark:text-blue-300 italic">
                {details.insights}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChartCard;
