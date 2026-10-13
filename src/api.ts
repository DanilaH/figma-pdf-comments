import {fileKey,validateComments,type Comment} from './model';
export async function getComments(url:string,token:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<{key:string;comments:Comment[]}>{
  const key=fileKey(url);
  if(!token.trim())throw Error('Enter a read-only personal access token.');
  const res=await fetcher(`https://api.figma.com/v1/files/${key}/comments?as_md=true`,{headers:{'X-Figma-Token':token.trim()},signal,redirect:'error',credentials:'omit'});
  if(res.status===429)throw Error(`Figma rate limit. Retry after ${res.headers.get('Retry-After')??'the suggested delay'} seconds.`);
  if(res.status===403)throw Error('Figma denied access. Check token expiry, file access and file_comments:read.');
  if(res.status===404)throw Error('Figma file not found or unavailable to this account.');
  if(!res.ok)throw Error(`Figma request failed (HTTP ${res.status}). No PDF was created.`);
  return {key,comments:validateComments(await res.json())};
}
