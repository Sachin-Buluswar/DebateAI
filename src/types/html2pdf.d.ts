declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      letterRendering?: boolean;
      logging?: boolean;
      [key: string]: unknown;
    };
    jsPDF?: {
      unit?: string;
      format?: string | number[];
      orientation?: 'portrait' | 'landscape';
      compress?: boolean;
      [key: string]: unknown;
    };
    pagebreak?: {
      mode?: string | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: string | HTMLElement): Html2Pdf;
    save(): Promise<void>;
    output(type: string, options?: unknown): Promise<unknown>;
    outputPdf(type: string): Promise<unknown>;
  }

  function html2pdf(): Html2Pdf;
  
  export default html2pdf;
}