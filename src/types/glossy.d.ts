declare module "glossy" {
  export const Parse: {
    parse(message: string): {
      host?: string;
      appName?: string;
      tag?: string;
      message?: string;
      date?: Date;
      priority?: number;
      [k: string]: unknown;
    };
  };
  const glossy: { Parse: typeof Parse };
  export default glossy;
}
