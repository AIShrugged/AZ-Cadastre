import type {
  AddressLookupRequest,
  AddressLookupResponse,
} from '../dto/index.js';

export interface AddressesApi {
  lookup(request: AddressLookupRequest): Promise<AddressLookupResponse>;
}
