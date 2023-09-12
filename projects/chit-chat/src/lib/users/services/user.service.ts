import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

import {
	FireStoreCollection,
	MapResult,
	MapResultCollection,
} from 'chit-chat/src/lib/utils';

import {
	collection,
	doc,
	getFirestore,
	setDoc,
} from 'firebase/firestore';
import { isEqual } from 'lodash-es';
import { Observable, distinctUntilChanged, map, tap } from 'rxjs';
import { DtoPermission, DtoUser, DtoUserRole } from '../dto';
import { User, UserRole } from '../models';
import { UserStatus } from '../types';

@Injectable({
	providedIn: 'root',
})
export class UserService {
	constructor(private afs: AngularFirestore) {
		// const user: DtoUser = {
		// 	uid: 'zX3f1LIbs1XceEcOMKkIh9vMYkz1',
		// 	name: 'Test again',
		// 	roleId: 'admin',
		// 	creationDate: new Date(),
		// 	avatar: null,
		// 	onlineStatus: 'available',
		// 	isActivated: true,
		// };
		// this.createUser(user);
	}

	getUsers = (
		activatedUsersOnly: boolean = false
	): Observable<MapResultCollection<User>> => {
		return this.afs
			.collection<DtoUser>(FireStoreCollection.USERS, (ref) =>
				!!activatedUsersOnly
					? ref.where('isActivated', '==', true).orderBy('name')
					: ref.orderBy('name')
			)
			.valueChanges()
			.pipe(
				distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
				tap((result) => console.log(result)),
				map<DtoUser[], MapResultCollection<DtoUser>>((result) =>
					User.fromCollection(result)
				)
			);
	};

	getUsersBatch = (
		lastSeenName: string | null,
		batchSize: number,
		activatedUsersOnly: boolean = false
	): Observable<any> => {
		return this.afs
			.collection<DtoUser>(FireStoreCollection.USERS, (ref) =>
				!!activatedUsersOnly
					? ref
							.where('isActivated', '==', true)
							.orderBy('name')
							.startAfter(lastSeenName)
							.limit(batchSize)
					: ref
							.orderBy('name')
							.startAfter(lastSeenName)
							.limit(batchSize)
			)
			.snapshotChanges()
			.pipe(
				distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
				map((result) => {
					return result.reduce((acc, cur) => {
						const id = cur.payload.doc.id;
						const data = cur.payload.doc.data();
						return { ...acc, [id]: data };
					}, {});
				})
				// map<DtoUser[], MapResultCollection<DtoUser>>((result) =>
				// 	User.fromCollection(result)
				// ),
			);
	};

	setUserStatus = async (
		documentID: string,
		status: UserStatus
	): Promise<void> => {
		return this.afs
			.collection(FireStoreCollection.USERS)
			.doc(documentID)
			.update({ onlineStatus: status });
	};

	createUser = async (data: DtoUser): Promise<void> => {
		const fireStore = getFirestore();
		const usersRef = collection(fireStore, FireStoreCollection.USERS);

		try {
			return await setDoc(
				doc(usersRef, data.uid),
				JSON.parse(JSON.stringify(data))
			);
		} catch (e: any) {
			throw Error(
				`Something went wrong when creating user with uid ${data.uid}. ${e}`
			);
		}
	};

	getUserRoleWithPermissions = (
		roleId: string
	): Observable<MapResult<UserRole>> => {
		const query = this.afs
			.collection<DtoUserRole>(FireStoreCollection.ROLES)
			.doc(roleId)
			.collection<DtoPermission>(
				FireStoreCollection.ROLES_PERMISSIONS
			);
		return query.get().pipe(
			map((result) => {
				const permissions: (DtoPermission & { id: string })[] =
					result.docs.map((permission) =>
						Object.assign(permission.data(), {
							id: permission.ref.id,
						})
					);

				return UserRole.fromPermissionDto(permissions);
			})
		);
	};
}