import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export const GroupedBarChart = ({
  data,
  title,
  yAxisLabel,
  colors = ["#3b82f6", "#10b981"]
}) => {
  return (
    <motion.div
      className="w-full h-80  rounded-xl  p-4 flex flex-col"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Title */}
      <motion.h3
        className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {title}
      </motion.h3>

      {/* Chart */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          barGap={8}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(156, 163, 175, 0.3)"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--tw-prose-body)" }}
            axisLine={{ stroke: "rgba(156, 163, 175, 0.4)" }}
          />
          <YAxis
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              fill: "var(--tw-prose-body)"
            }}
            tick={{ fill: "var(--tw-prose-body)" }}
            axisLine={{ stroke: "rgba(156, 163, 175, 0.4)" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(31, 41, 55, 0.85)",
              border: "none",
              borderRadius: "0.5rem",
              color: "#fff"
            }}
            itemStyle={{ color: "#fff" }}
          />
          <Legend wrapperStyle={{ paddingTop: "8px", borderRadius: "1.5rem", }}  />

          {/* Animated Bars */}
          <Bar
            dataKey="used"
            fill={colors[0]}
            name="Used"
            radius={[6, 6, 0, 0]}
            shape={(props) => (
              <AnimatedBar {...props} barColor={colors[0]} />
            )}
          />
          <Bar
            dataKey="requested"
            fill={colors[1]}
            name="Requested"
            radius={[6, 6, 0, 0]}
            shape={(props) => (
              <AnimatedBar {...props} barColor={colors[1]} />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/**
 * Custom bar component with Framer Motion animation
 */
const AnimatedBar = ({ x, y, width, height, barColor }) => {
  return (
    <motion.rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx="6"
      fill={barColor}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        transformOrigin: "bottom center",
        // borderTopRightRadius: "0.5rem",
        // borderTopLeftRadius: "0.5rem"
      }}
    />
  );
};
