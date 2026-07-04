import { attendanceDB } from '../../config/database.js';

export async function getAssignedLocations({ user_id }) {
    const assignedLocations = await attendanceDB("org_user_work_locations")
        .join("org_work_locations", "org_user_work_locations.location_id", "org_work_locations.location_id")
        .where("org_user_work_locations.user_id", user_id)
        .where("org_work_locations.is_active", true)
        .select(
            "org_work_locations.location_id",
            "org_work_locations.location_name",
            "org_work_locations.address",
            "org_work_locations.latitude",
            "org_work_locations.longitude",
            "org_work_locations.radius"
        );

    return assignedLocations;
}