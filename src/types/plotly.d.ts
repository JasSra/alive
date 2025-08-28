declare module "react-plotly.js" {
  import * as React from "react";
  const Plot: React.ComponentType<unknown>;
  export default Plot;
}

declare module "react-plotly.js/factory" {
  const factory: (plotly: unknown) => unknown;
  export default factory;
}

declare module "plotly.js-dist-min" {
  const Plotly: unknown;
  export default Plotly;
}
