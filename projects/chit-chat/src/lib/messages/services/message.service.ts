import { Injectable } from '@angular/core';
import {
	AngularFirestore,
	DocumentChangeAction,
} from '@angular/fire/compat/firestore';
import { FireStoreCollection } from 'chit-chat/src/lib/utils';
import {
	collection,
	doc,
	getFirestore,
	setDoc,
} from 'firebase/firestore';
import { isEqual } from 'lodash-es';
import { Observable, of } from 'rxjs';
import {
	catchError,
	distinctUntilChanged,
	map,
	switchMap,
} from 'rxjs/operators';
import { DtoMessage } from '../dto';
import { Message } from './../models/message.model';

@Injectable({
	providedIn: 'root',
})
export class MessageService {
	constructor(private afs: AngularFirestore) {
		// mockdata.forEach(async (element) => {
		// 	console.log('gets to message create', element);
		// });
	}

	sendMessage = async (data: DtoMessage): Promise<void> => {
		const fireStore = getFirestore();
		const messagesRef = collection(
			fireStore,
			FireStoreCollection.MESSAGES
		);

		try {
			return await setDoc(
				doc(messagesRef),
				JSON.parse(JSON.stringify(data))
			);
		} catch (e: any) {
			throw Error(`Something went wrong when sending message. ${e}`);
		}
	};

	getMessages = (
		lastSeen: Message | null,
		batchSize: number
	): Observable<Message[]> => {
		return of(lastSeen).pipe(
			switchMap((lastSeenMessage) => {
				const query = this.afs.collection<DtoMessage>(
					FireStoreCollection.MESSAGES,
					(ref) => {
						let modifiedRef = ref.orderBy('sendAt', 'desc');
						if (lastSeenMessage) {
							// If lastSeen is not null, fetch the next batchSize messages after lastSeenMessage
							modifiedRef = modifiedRef.startAfter(
								lastSeenMessage.sendAt
							);
						}
						return modifiedRef.limit(batchSize);
					}
				);
				return query.snapshotChanges();
			}),
			distinctUntilChanged((prev, curr) => isEqual(prev, curr)),

			map<Array<DocumentChangeAction<DtoMessage>>, Message[]>(
				(result) => {
					const dtos = result.map((document) => ({
						id: document.payload.doc.id,
						...document.payload.doc.data(),
					}));
					return Message.fromDtoCollection(dtos).data;
				}
			),
			// tap((result) => console.log('fetch', result)),

			catchError((error: any) => {
				console.error(error);
				return of([] as Message[]); // Return an empty array in case of an error
			})
		);
	};

	// getMessages = (
	// 	lastSeen: Message | null,
	// 	batchSize: number
	// ): Observable<Message[]> => {
	// 	return this.afs
	// 		.collection<DtoMessage>(FireStoreCollection.MESSAGES, (ref) =>
	// 			ref
	// 				.orderBy('sendAt')
	// 				.startAfter(!!lastSeen ? lastSeen.sendAt : null)
	// 				.limit(batchSize)
	// 		)
	// 		.snapshotChanges()
	// 		.pipe(
	// 			distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
	// 			map<Array<DocumentChangeAction<DtoMessage>>, Message[]>(
	// 				(result) => {
	// 					const dtos = result.map((document) => ({
	// 						id: document.payload.doc.id,
	// 						...document.payload.doc.data(),
	// 					}));
	// 					return Message.fromDtoCollection(dtos).data;
	// 				}
	// 			),
	// 			catchError((error: any) => {
	// 				console.error(error);
	// 				return throwError(
	// 					() => new Error('Error occurred while fetching messages.')
	// 				).pipe(startWith([] as Message[]));
	// 			})
	// 		);
	// };
}
