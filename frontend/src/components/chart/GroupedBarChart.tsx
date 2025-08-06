import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const GroupedBarChart = ({ data, title, yAxisLabel, colors = ['#8884d8', '#82ca9d'] }) => {
  return (
    <div className="w-full h-80">
      <h3 className="text-lg font-medium mb-4 colors-h3-text">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
          <Tooltip labelClassName='colors-h3-text' />
          <Legend />
          <Bar dataKey="used" fill={colors[0]} name="Used" />
          <Bar dataKey="requested" fill={colors[1]} name="Requested" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};