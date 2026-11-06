import axios from "../config/axios";

export const GetRequest = (url: string, config: Record<string, unknown> = {}) => {
  return axios.get(url, config);
};

export const PostRequest = (url: string, params: Record<string, unknown> = {}, config = {}) => {
  return axios.post(url, params, config);
};

export const PutRequest = (url: string, params: Record<string, unknown> = {}, config = {}) => {
  //only for update not post
  return axios.put(url, params, config);
};

export const DeleteRequest = (url: string, data?: unknown) => {
  return axios.delete(url, { data });
};

export const PatchRequest = (url: string, data?: unknown, config = {}) => {
  return axios.patch(url, data, config);
};
