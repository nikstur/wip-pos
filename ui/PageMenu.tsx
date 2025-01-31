import { css } from "@emotion/css";
import { addHours, isWithinRange, subHours } from "date-fns";
import { groupBy } from "lodash";
import { useFind } from "meteor/react-meteor-data";
import { darken, lighten, transparentize } from "polished";
import React, { Fragment, SVGProps, useMemo, useState } from "react";
import Products, { isAlcoholic } from "../api/products";
import Sales from "../api/sales";
import Styles, { type IStyle } from "../api/styles";
import { useKeyDownListener } from "../components/BarcodeScanner";
import ProductTrend from "../components/ProductTrend";
import useCurrentCamp from "../hooks/useCurrentCamp";
import useCurrentDate from "../hooks/useCurrentDate";
import useCurrentLocation from "../hooks/useCurrentLocation";
import useSubscription from "../hooks/useSubscription";
import { emptyArray, emptyObject, getCorrectTextColor } from "../util";

function SparkLine({
  data,
  strokeWidth = 1,
  stroke = "transparent",
  fill,
  ...props
}: {
  data: [number, number][];
} & SVGProps<SVGSVGElement>) {
  const viewBoxWidth = 1000;
  const viewBoxHeight = 10;

  const pathD = useMemo(() => {
    const xOffset = 0;
    const yOffset = viewBoxHeight;
    let minX: number | null = null,
      maxX: number | null = null,
      minY: number | null = null,
      maxY: number | null = null;

    for (const [x, y] of data) {
      if (!minX || x < minX) minX = x;
      if (!maxX || x > maxX) maxX = x;
      if (!minY || y < minY) minY = y;
      if (!maxY || y > maxY) maxY = y;
    }
    const XDelta = maxX! - minX!;
    const YDelta = maxY! - minY!;
    const dataPoints = data
      .map(([x, y]) =>
        [
          "L",
          xOffset + ((x - minX!) / XDelta) * viewBoxWidth,
          yOffset - ((y - minY!) / YDelta) * viewBoxHeight,
        ].join(" "),
      )
      .join(" ");

    return `M 0 ${viewBoxHeight} L ${viewBoxWidth} ${viewBoxHeight} ${dataPoints}`;
  }, [data]);

  return (
    <svg
      width="100%"
      height={viewBoxHeight}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="none"
      {...props}
    >
      {pathD && (
        <path d={pathD} stroke={stroke} strokeWidth={strokeWidth} fill={fill} />
      )}
    </svg>
  );
}

const sparklineDays = 24;
export default function PageMenu() {
  const currentCamp = useCurrentCamp();
  const currentDate = useCurrentDate(1000);
  const from = useMemo(
    () => subHours(currentDate, sparklineDays),
    [currentDate],
  );
  const { location, error } = useCurrentLocation();
  const [isExpressMode, setIsExpressMode] = useState(false);

  useKeyDownListener((event) => {
    if (event.key === "x") {
      event.preventDefault();

      setIsExpressMode((state) => !state);
    }
  });

  const sales = useFind(
    () => Sales.find({ timestamp: { $gte: from } }),
    [from],
  );

  const style =
    useFind(() => Styles.find({ page: "menu" }))?.[0]?.style ||
    (emptyObject as IStyle["style"]);

  useSubscription("sales", { from }, [from]);
  const products = useFind(
    () =>
      Products.find(
        {
          removedAt: { $exists: false },
          // @ts-expect-error
          locationIds: { $elemMatch: { $eq: location?._id } },
        },
        { sort: { brandName: 1, name: 1 } },
      ),
    [location],
  );

  const productsGroupedByTags = useMemo(
    () =>
      Object.entries(
        groupBy(
          products
            .filter((product) =>
              location?.curfew ? !isAlcoholic(product) : true,
            )
            .filter((product) =>
              isExpressMode
                ? !product.tags?.includes("tap") &&
                  !product.tags?.includes("cocktail")
                : true,
            ),
          ({ tags }) =>
            [...(tags || emptyArray)].sort()?.join(",") ||
            //?.replace("beer,can", "beer")
            //?.replace("beer,bottle", "beer")
            //?.replace("beer,tap", "tap")
            //?.replace("bottle,soda", "soda")
            "other",
        ),
      ),
    [isExpressMode, location?.curfew, products],
  );

  if (error) return error;

  if (location?.closed) {
    return (
      <div
        className={css`
          font-size: 3em;
          flex: 1;
          background: ${Number(currentDate.getSeconds()) % 2
            ? currentCamp && getCorrectTextColor(currentCamp.color)
            : currentCamp?.color};
          color: ${Number(currentDate.getSeconds()) % 2
            ? currentCamp?.color
            : currentCamp && getCorrectTextColor(currentCamp.color)};
          font-size: 6em;
          height: 80vh;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
        `}
      >
        <center>
          We are closed
          <br />
          at the moment
          <br />
          <img
            src="/img/logo_square_white_on_transparent_500_RGB.png"
            className={css`
              width: 20vh;
              margin: -5vh;
            `}
          />
        </center>
      </div>
    );
  }

  if (!productsGroupedByTags.length) {
    return (
      // eslint-disable-next-line react/no-unknown-property
      <marquee scrollAmount="20">
        <big
          className={css`
            font-size: 6em;
            height: 80vh;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
          `}
        >
          <center>
            Nothing for sale
            <br />
            at the moment :(
          </center>
        </big>
        <center>
          <pre>Rendered: {new Date().toLocaleString()}</pre>
        </center>
      </marquee>
    );
  }
  return (
    <div
      className={css`
        font-size: 0.8em;
        padding: 0.5em;
        column-width: 15em;
        @media (min-width: 1400px) {
          column-width: 16vw;
        }
        column-fill: balance;
        column-gap: 0.5em;
        max-width: 100%;
        break-inside: avoid;
        min-height: 100%;
      `}
      style={style}
    >
      {productsGroupedByTags
        .sort((a, b) => a[0].localeCompare(b[0]))
        .sort((a, b) => b[1].length - a[1].length)
        .map(([tags, products]) => {
          const productsByBrandName = Object.entries(
            groupBy(products, ({ brandName }) => brandName),
          )
            .sort(([, a], [, b]) => b.length - a.length)
            .map(
              ([brand, products]) =>
                [
                  brand,
                  products
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .sort((a, b) => a.tap?.localeCompare(b.tap || "") || 0),
                ] as const,
            )
            .sort(
              ([, aProducts], [, bProducts]) =>
                aProducts?.[0]?.tap?.localeCompare(bProducts?.[0]?.tap || "") ||
                0,
            );

          return (
            <div
              key={tags}
              className={css`
                color: ${currentCamp &&
                getCorrectTextColor(
                  getCorrectTextColor(currentCamp?.color) === "white"
                    ? lighten(4 / 5, currentCamp?.color)
                    : darken(4 / 5, currentCamp?.color),
                )};

                break-inside: avoid;
                padding: 0.25em;
                margin-bottom: 0.5em;
              `}
            >
              <h1
                className={css`
                  margin: 0;
                  font-size: 2.25em;
                  text-align: center;
                `}
              >
                {tags}
              </h1>
              <SparkLine
                className={css`
                  display: block;
                  border-bottom: ${currentCamp &&
                    getCorrectTextColor(
                      getCorrectTextColor(currentCamp?.color) === "white"
                        ? lighten(4 / 5, currentCamp?.color)
                        : darken(4 / 5, currentCamp?.color),
                    )}
                    1px solid;
                `}
                fill={
                  currentCamp &&
                  getCorrectTextColor(
                    getCorrectTextColor(currentCamp?.color) === "white"
                      ? lighten(4 / 5, currentCamp?.color)
                      : darken(4 / 5, currentCamp?.color),
                  )
                }
                data={Array.from({ length: sparklineDays }, (_, i) => [
                  sparklineDays - 1 - i,
                  sales.reduce((memo, sale) => {
                    if (
                      isWithinRange(
                        sale.timestamp,
                        addHours(currentDate, -i - 1),
                        addHours(currentDate, -i),
                      )
                    ) {
                      return (
                        memo +
                        sale.products.filter((saleProduct) =>
                          productsByBrandName
                            .map(([, products]) => products)
                            .flat()
                            .some((product) => saleProduct._id === product._id),
                        ).length
                      );
                    }
                    return memo;
                  }, 0),
                ])}
              />
              <div
                className={css`
                  background: ${currentCamp &&
                  transparentize(
                    4 / 5,
                    getCorrectTextColor(currentCamp?.color),
                  )};
                  color: ${currentCamp &&
                  getCorrectTextColor(
                    getCorrectTextColor(currentCamp?.color) === "white"
                      ? lighten(4 / 5, currentCamp?.color)
                      : darken(4 / 5, currentCamp?.color),
                  )};

                  break-inside: avoid;
                  padding: 0.25em;
                  margin-bottom: 0.5em;
                `}
              >
                <ul
                  className={css`
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25em;
                  `}
                >
                  {productsByBrandName.map(([brandName, products]) => (
                    <>
                      <small
                        className={css`
                          flex: 1;
                          display: flex;
                          justify-content: space-around;
                        `}
                      >
                        <small
                          className={css`
                            flex: 1;
                            text-align: center;
                          `}
                        >
                          {brandName}
                        </small>
                        <small>ʜᴀx</small>
                      </small>
                      <li
                        key={brandName}
                        className={css`
                          margin: 0;
                          padding: 0.25em 0.5em 0px;
                          display: flex;
                          flex-direction: column;
                          background: ${currentCamp &&
                          transparentize(
                            4 / 5,
                            getCorrectTextColor(currentCamp?.color),
                          )};
                          align-items: stretch;
                          break-inside: avoid;

                          border: 1px solid
                            ${currentCamp &&
                            transparentize(
                              1 / 5,
                              getCorrectTextColor(currentCamp?.color),
                            )};
                          position: relative;
                        `}
                      >
                        {brandName === "BornHack" &&
                        tags.includes("spirit") &&
                        tags.includes("bottle") ? (
                          <img
                            src="/img/logo_square_white_on_transparent_500_RGB.png"
                            className={css`
                              object-fit: contain;
                              position: absolute;
                              height: 100%;
                              width: auto;
                              top: 50%;
                              left: 50%;
                              transform: translate(-50%, -50%);
                              opacity: 0.75;
                              z-index: 0;
                            `}
                          />
                        ) : null}
                        <div
                          className={css`
                            display: flex;
                            flex-direction: column;
                            gap: 0.125em;
                          `}
                        >
                          {products.map((product) => (
                            <div
                              key={product._id}
                              className={css`
                                position: relative;
                                break-inside: avoid;
                                ${product.salePrice == 0
                                  ? `
                                box-shadow: 0 0 20px black, 0 0 40px black;
                                color: black;
                                background: rgba(255, 0, 0, 0.75);
                                padding: 0 4px;
                                animation-name: wobble;
                                animation-iteration-count: infinite;
                                animation-duration: 2s;
                                z-index: 50;
                            `
                                  : ""}
                              `}
                            >
                              <ProductTrend
                                product={product}
                                className={css`
                                  position: absolute !important;
                                  bottom: 0;
                                  width: 100%;
                                  z-index: 0;
                                `}
                              />
                              <div
                                className={css`
                                  flex: 1;
                                  display: flex;
                                  justify-content: space-between;
                                `}
                              >
                                <span>
                                  <div
                                    className={css`
                                      font-weight: 500;
                                    `}
                                  >
                                    {product.name}
                                  </div>
                                  <small
                                    className={css`
                                      margin-top: -0.25em;
                                      display: block;
                                    `}
                                  >
                                    {[
                                      product.description || null,
                                      (typeof product.abv === "number" &&
                                        !Number.isNaN(product.abv)) ||
                                      (typeof product.abv === "string" &&
                                        product.abv)
                                        ? `${product.abv}%`
                                        : null,
                                      typeof product.sizeUnit === "string" &&
                                      typeof product.unitSize === "number" &&
                                      product.sizeUnit &&
                                      product.unitSize
                                        ? `${product.unitSize}${product.sizeUnit}`
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .map((thing, i) => (
                                        <Fragment key={thing}>
                                          {i > 0 ? ", " : null}
                                          <small key={thing}>{thing}</small>
                                        </Fragment>
                                      ))}
                                  </small>
                                </span>
                                <div
                                  className={css`
                                    text-align: right;
                                  `}
                                >
                                  <b>{Number(product.salePrice) || "00"}</b>
                                  {product.tap ? (
                                    <div
                                      className={css`
                                        line-height: 0.5;
                                        white-space: nowrap;
                                      `}
                                    >
                                      <small>🚰 {product.tap}</small>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <SparkLine
                                className={css`
                                  margin-left: -0.5em;
                                  margin-right: -0.5em;
                                  width: calc(100% + 1em);
                                  display: block;
                                  border-bottom: ${currentCamp?.color} 1px solid;
                                `}
                                fill={currentCamp?.color}
                                data={Array.from(
                                  { length: sparklineDays },
                                  (_, i) => [
                                    sparklineDays - 1 - i,
                                    sales.reduce((memo, sale) => {
                                      if (
                                        isWithinRange(
                                          sale.timestamp,
                                          addHours(currentDate, -i - 1),
                                          addHours(currentDate, -i),
                                        )
                                      ) {
                                        return (
                                          memo +
                                          sale.products.filter(
                                            (saleProduct) =>
                                              saleProduct._id === product._id,
                                          ).length
                                        );
                                      }
                                      return memo;
                                    }, 0),
                                  ],
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </li>
                    </>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      <center
        className={css`
          margin-top: -0.5em;
          margin-bottom: 1em;
          font-size: 0.6em;
        `}
      >
        <pre>Rendered: {new Date().toLocaleString()}</pre>
      </center>
      <p>
        Why do they call it oven when you of in the cold food of out hot eat the
        food?
      </p>
    </div>
  );
}
