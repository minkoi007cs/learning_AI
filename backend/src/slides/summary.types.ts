/**
 * Kết quả AI sinh ra cho một bản tóm tắt slide.
 *
 * CÓ HAI ĐỜI DỮ LIỆU:
 *  • v1 (`SlideSummary`) — bản cũ: gạch đầu dòng ngắn. Vẫn nằm trong database
 *    của những bản đã tạo trước đây nên KHÔNG được xoá kiểu này đi.
 *  • v2 (`StudyGuide`)   — bản mới: giải thích thành đoạn văn, ví dụ áp dụng,
 *    lỗi thường gặp, câu tự kiểm tra, hình kèm chú thích.
 *
 * Nguyên tắc ngôn ngữ (tech.md §0): nội dung học thuật, định nghĩa, công thức
 * giữ TIẾNG ANH — sinh viên phải quen thuật ngữ để đi thi. Tiếng Việt là chú
 * thích ngắn ở lề để hiểu nhanh, không dịch lại toàn bộ.
 */

export interface KeyTerm {
  term: string; // thuật ngữ tiếng Anh, đúng như trên slide
  definitionEn: string; // định nghĩa giữ tiếng Anh
  glossVi: string; // chú thích tiếng Việt ngắn
  /** v2: ví dụ một câu cho thấy thuật ngữ được dùng thế nào. */
  exampleEn?: string;
}

export interface SummarySection {
  heading: string; // tiêu đề mục (tiếng Anh)
  headingVi?: string; // chú thích tiêu đề bằng tiếng Việt
  points: string[]; // ý chính, gạch đầu dòng
}

/** Bản tóm tắt đời cũ — giữ nguyên để mở lại các bản đã lưu. */
export interface SlideSummary {
  title: string;
  overviewVi: string;
  overviewEn: string;
  sections: SummarySection[];
  keyTerms: KeyTerm[];
  formulas: string[];
  examTips: string[];
}

/* ─────────────────────────── Đời mới (v2) ─────────────────────────── */

/** Hình rút từ slide, đã lưu trên kho ảnh và được AI chú thích. */
export interface GuideFigure {
  id: string; // "fig-3"
  url: string; // địa chỉ công khai của ảnh
  page: number; // nằm ở slide số mấy
  width: number;
  height: number;
  /** Chú thích do AI viết sau khi nhìn ảnh. Rỗng nếu chưa kịp chú thích. */
  captionEn?: string;
  captionVi?: string;
  /** Ảnh này minh hoạ cho mục nào (khớp với `GuideSection.id`). */
  sectionId?: string;
}

export interface GuideCheck {
  q: string; // câu hỏi tự kiểm tra (tiếng Anh)
  a: string; // đáp án gọn
}

export interface GuideFormula {
  expression: string; // công thức, chép nguyên văn nếu có trên slide
  meaningEn: string; // đọc hiểu công thức bằng tiếng Anh
  meaningVi?: string; // chú thích tiếng Việt
}

export interface GuideSection {
  id: string; // "sec-2" — để gắn hình vào đúng mục
  heading: string;
  headingVi?: string;
  /** Trích dẫn nguồn trong tài liệu gốc, ví dụ "Slides 4–7". */
  slideRange?: string;
  /**
   * Phần cốt lõi của study guide: giải thích nhiều đoạn bằng tiếng Anh —
   * KHÔNG phải gạch đầu dòng. Đây chính là thứ bản cũ thiếu.
   */
  explanationEn: string;
  /** Chú thích tiếng Việt ngắn, hiện ở lề phải theo bố cục "Bản vẽ". */
  notesVi: string[];
  /** Ý chính rút gọn — để lướt nhanh trước khi thi. */
  points: string[];
  /** Ví dụ áp dụng có tính toán hoặc tình huống cụ thể. */
  exampleEn?: string;
  exampleVi?: string;
  /** Lỗi sinh viên hay mắc ở phần này (tiếng Việt cho dễ thấm). */
  pitfallsVi?: string[];
  /** Câu hỏi tự kiểm tra sau khi đọc xong mục. */
  checks?: GuideCheck[];
}

export interface StudyGuide {
  version: 2;
  title: string;
  overviewEn: string;
  overviewVi: string;
  sections: GuideSection[];
  keyTerms: KeyTerm[];
  formulas: GuideFormula[];
  examTips: string[];
  figures: GuideFigure[];
  /** Đã đọc bao nhiêu slide — hiện ở đầu trang cho người dùng yên tâm. */
  sourcePages?: number;
}

/** Nhận biết bản ghi nào là đời mới. */
export function isStudyGuide(value: unknown): value is StudyGuide {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as StudyGuide).version === 2 &&
    Array.isArray((value as StudyGuide).sections)
  );
}
