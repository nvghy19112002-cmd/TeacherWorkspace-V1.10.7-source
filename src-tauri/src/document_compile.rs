use serde::Deserialize;
use std::{fs, path::{Component, Path, PathBuf}, process::{Command, Stdio}, sync::{Arc, atomic::{AtomicBool,Ordering}}, time::{Duration,Instant,SystemTime,UNIX_EPOCH}};
use tauri::Manager;
use crate::tex_preview::{Settings,PreviewState,CompileResult,executable,validate};
#[derive(Deserialize)]
pub struct ProjectFile { path:String, bytes:Vec<u8> }
fn relative(value:&str)->Result<PathBuf,String>{let path=Path::new(value);if value.is_empty()||value.contains('\\')||path.is_absolute()||path.components().any(|c|!matches!(c,Component::Normal(_))){return Err("Đường dẫn file không hợp lệ.".into());}Ok(path.to_path_buf())}
struct Cleanup(PathBuf,Arc<AtomicBool>);
impl Drop for Cleanup{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);self.1.store(false,Ordering::SeqCst);}}
#[tauri::command]
pub async fn document_project_compile(app:tauri::AppHandle,state:tauri::State<'_,PreviewState>,mut settings:Settings,main_path:String,files:Vec<ProjectFile>)->Result<CompileResult,String>{
 settings.preamble_path.clear();settings.project_dir.clear();settings.mode="integrated".into();validate(&settings)?;
 let main=relative(&main_path)?;if main.extension().and_then(|s|s.to_str()).map(|s|s.eq_ignore_ascii_case("tex"))!=Some(true){return Err("Chọn file chính .tex.".into());}
 if files.len()>5000||files.iter().map(|f|f.bytes.len()).sum::<usize>()>100*1024*1024{return Err("Bộ đề vượt giới hạn 100 MB/5000 file.".into());}
 if !files.iter().any(|f|f.path==main_path){return Err("Không tìm thấy file chính.".into());}
 let mut seen=std::collections::HashSet::new();for file in &files{relative(&file.path)?;if !seen.insert(file.path.to_lowercase()){return Err("Đường dẫn bị trùng.".into());}}
 let base=app.path().app_cache_dir().map_err(|e|e.to_string())?;
 if state.busy.swap(true,Ordering::SeqCst){return Err("Một lượt TeX đang chạy. Hãy đợi hoặc dừng lượt trước.".into());}
 state.cancel.store(false,Ordering::SeqCst);let busy=state.busy.clone();let cancel=state.cancel.clone();
 tauri::async_runtime::spawn_blocking(move||{
  let nonce=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();let root=base.join(format!("document-project-{nonce}"));let _cleanup=Cleanup(root.clone(),busy);fs::create_dir_all(&root).map_err(|e|e.to_string())?;
  for file in files{let path=root.join(relative(&file.path)?);if let Some(parent)=path.parent(){fs::create_dir_all(parent).map_err(|e|e.to_string())?;}fs::write(path,file.bytes).map_err(|e|e.to_string())?;}
  let working=root.join(main.parent().unwrap_or(Path::new("")));let name=main.file_name().ok_or("Tên file chính không hợp lệ.")?;let output=root.join(".teacher-build");fs::create_dir_all(&output).map_err(|e|e.to_string())?;
  let engine=executable(&settings);let start=Instant::now();let mut success=true;
  for pass in 0..2{let stdout=fs::File::create(output.join(format!("stdout-{pass}.txt"))).map_err(|e|e.to_string())?;let stderr=stdout.try_clone().map_err(|e|e.to_string())?;let mut command=Command::new(&engine);command.current_dir(&working).args(["-no-shell-escape","-interaction=nonstopmode","-halt-on-error","-file-line-error","-jobname=compiled"]).arg(format!("-output-directory={}",output.display())).arg(name).env("TEXINPUTS",format!(".{}{}//{}",if cfg!(windows){";"}else{":"},root.to_string_lossy().replace('\\',"/"),if cfg!(windows){";"}else{":"})).env("openout_any","p").stdin(Stdio::null()).stdout(Stdio::from(stdout)).stderr(Stdio::from(stderr));
   #[cfg(windows)]{use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
   let mut child=command.spawn().map_err(|e|format!("Không chạy được TeX Live: {e}"))?;let status=loop{if cancel.load(Ordering::SeqCst)||start.elapsed()>Duration::from_secs(120){let _=child.kill();let _=child.wait();return Err("Đã dừng hoặc vượt quá 120 giây.".into());}match child.try_wait(){Ok(Some(status))=>break status,Ok(None)=>std::thread::sleep(Duration::from_millis(50)),Err(e)=>{let _=child.kill();let _=child.wait();return Err(e.to_string());}}};if !status.success(){success=false;break;}}
  let log=fs::read(output.join("compiled.log")).or_else(|_|fs::read(output.join("stdout-0.txt"))).unwrap_or_default();let pdf_path=output.join("compiled.pdf");let pdf=if success{if fs::metadata(&pdf_path).map_err(|e|e.to_string())?.len()>32*1024*1024{return Err("PDF vượt quá 32 MB.".into());}fs::read(pdf_path).map_err(|e|e.to_string())?}else{vec![]};Ok(CompileResult{success,pdf,log:String::from_utf8_lossy(&log).chars().take(150000).collect()})
 }).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::relative;

    #[test]
    fn project_paths_reject_traversal_and_windows_separators() {
        for path in ["", "../main.tex", "/tmp/main.tex", "chapters/../../main.tex", "chapters\\main.tex"] {
            assert!(relative(path).is_err(), "accepted unsafe project path: {path}");
        }
        #[cfg(windows)]
        assert!(relative("C:/main.tex").is_err());
    }

    #[test]
    fn project_paths_accept_nested_files_and_spaces() {
        for path in ["main.tex", "chapters/bai 1.tex", "images/diagram.pdf"] {
            assert!(relative(path).is_ok(), "rejected project path: {path}");
        }
    }
}
