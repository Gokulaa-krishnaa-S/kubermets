import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const DonutChart = ({ data, title, centerLabel = '' }) => {
  const renderCustomTooltip = (props) => {
    if (props.active && props.payload && props.payload[0]) {
      const data = props.payload[0];
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{`${data.name}`}</p>
          <p className="text-blue-600">{`${data.payload.label || 'Value'}: ${data.value}`}</p>
          {data.payload.percentage && (
            <p className="text-gray-600">{`Percentage: ${data.payload.percentage}%`}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <h3 className="text-lg font-medium mb-4  text-gray-700 dark:text-white">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip   labelClassName='text-gray-700 dark:text-white'   content={renderCustomTooltip} />
          <Legend />
          {centerLabel && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-lg font-medium  text-gray-700 dark:text-white">
              {centerLabel}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
