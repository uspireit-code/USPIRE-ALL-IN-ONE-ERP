export type IfrsDisclosureNoteCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type IfrsStatementReference = {
    statement: 'BS' | 'PL' | 'CF' | 'SOCE';
    lineCode?: string;
    lineLabel?: string;
    amount?: number;
    asOf?: string;
    from?: string;
    to?: string;
};
export type IfrsDisclosureTable = {
    title: string;
    columns: Array<{
        key: string;
        label: string;
        align?: 'left' | 'right';
    }>;
    rows: Array<Record<string, any>>;
};
export type IfrsDisclosureNoteDto = {
    noteCode: IfrsDisclosureNoteCode;
    title: string;
    narrative?: string;
    footnotes?: string[];
    tables: IfrsDisclosureTable[];
    statementReferences: IfrsStatementReference[];
};
export type IfrsDisclosureNotesIndexItem = {
    noteCode: IfrsDisclosureNoteCode;
    title: string;
};
