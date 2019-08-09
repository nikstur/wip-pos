import { css } from "emotion";
import React from "react";
import { Route, Switch } from "react-router";
import { Link } from "react-router-dom";
import useCurrentUser from "../hooks/useCurrentUser";
import AccountsUIWrapper from "./AccountsUIWrapper";
import App from "./App";
import PageSales from "./PageSales";
import PageStock from "./PageStock";

export default function UI() {
  const user = useCurrentUser();

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
      <div
        className={css`
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 2px solid rgba(0, 0, 0, 0.3);
        `}
      >
        <AccountsUIWrapper />
        <nav
          className={css`
            padding: 1em;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `}
        >
          {user ? (
            <>
              <Link to="/">Sell</Link>
              <Link to="/stock">Stock</Link>
              <Link to="/sales">Sales</Link>
            </>
          ) : null}
          <Link to="/stats">Stats</Link>
        </nav>
      </div>
      <Switch>
        {user ? (
          <>
            <Route exact path="/" component={App} />
            <Route exact path="/stock" component={PageStock} />
            <Route exact path="/sales" component={PageSales} />
            <Route exact path="/stats" component={() => "stats"} />
          </>
        ) : (
          <>
            <Route exact path="/" component={() => "stats"} />
            <Route exact path="/stats" component={() => "stats"} />
          </>
        )}
      </Switch>
    </div>
  );
}
