/**
 * Đặt chế độ sáng/tối TRƯỚC khi trang vẽ ra.
 *
 * Vì sao phải là script chạy đồng bộ trong <head>, không phải useEffect:
 * nếu chờ React chạy xong mới đặt `data-theme`, người dùng chọn chế độ tối sẽ
 * thấy một nhoáng trắng loá mỗi lần mở trang. Với ứng dụng đọc bài buổi tối,
 * cái nhoáng đó rất khó chịu.
 *
 * Không đặt gì = đi theo cài đặt của máy (globals.css lo phần đó).
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('bv-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
