import {
  addHours,
  differenceInDays,
  endOfHour,
  isFuture,
  isWithinRange,
} from "date-fns";
import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Camps from "../api/camps";
import Sales from "../api/sales";
import useMongoFetch from "../hooks/useMongoFetch";

export default function DayByDay() {
  const { data: sales = [] } = useMongoFetch(Sales);
  const {
    data: [camp],
  } = useMongoFetch(Camps.find({}, { sort: { end: -1 } }));
  const numberOfDaysInCurrentCamp = differenceInDays(camp.end, camp.start);
  console.log(numberOfDaysInCurrentCamp);
  const data = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) =>
        Array.from({ length: numberOfDaysInCurrentCamp }).reduce(
          (memo, _, j) => {
            const hour = j * 24 + i;
            if (isFuture(addHours(camp.start, hour + 6))) return memo;
            return {
              ...memo,
              [j]:
                sales
                  .filter((sale) =>
                    isWithinRange(
                      sale.timestamp,
                      addHours(camp.start, j * 24 + 6),
                      endOfHour(addHours(camp.start, hour + 6)),
                    ),
                  )
                  .reduce((memo, sale) => memo + Number(sale.amount), 0) ||
                null,
            };
          },
          { x: i },
        ),
      ),
    [camp.start, numberOfDaysInCurrentCamp, sales],
  );
  console.log(data);
  //  return null;
  return (
    <ResponsiveContainer width="50%" height={350}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          interval={3}
          dataKey="x"
          tickFormatter={(hour) => String((hour + 8) % 24).padStart(2, "0")}
        />
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickFormatter={(amount) => ~~amount}
          label={{
            value: "Revenue (HAX)",
            angle: -90,
            offset: 70,
            position: "insideLeft",
            style: { fill: "yellow" },
          }}
        />
        <Tooltip
          labelFormatter={(hour) =>
            `H${String((hour + 8) % 24).padStart(2, "0")}`
          }
          fill="#000"
          contentStyle={{ background: "#000" }}
        />
        <Legend />
        {Array.from({ length: numberOfDaysInCurrentCamp }, (_, i) => (
          <ReferenceDot
            x={Math.max(...data.map((d) => (d[i] ? d.x : 0)))}
            y={Math.max(...data.map((d) => d[i] || 0))}
            key={i + "dot"}
            label={{
              value: `D${i + 1}`,
              position:
                Math.max(...data.map((d) => (d[i] ? d.x : 0))) > 21
                  ? "left"
                  : "right",
              style: { fill: camp?.color },
            }}
            fill={camp?.color}
            r={4}
            stroke={camp?.color}
          />
        ))}
        {Array.from({ length: numberOfDaysInCurrentCamp }, (_, i) => (
          <Line
            type="monotone"
            key={i}
            dataKey={i}
            name={`D${i + 1}`}
            strokeDasharray={
              numberOfDaysInCurrentCamp - 1 === i ? undefined : "3 3"
            }
            strokeWidth={numberOfDaysInCurrentCamp - 1 === i ? 4 : 3}
            stroke={camp.color}
            strokeOpacity={1 - (numberOfDaysInCurrentCamp - 1 - i) / 10}
            style={{
              opacity: 1 - (numberOfDaysInCurrentCamp - 1 - i) / 10,
            }}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
