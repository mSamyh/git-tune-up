import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldOff } from "lucide-react";

export const UserRoleManager = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      toast({
        variant: "destructive",
        title: "Failed to fetch users",
        description: profilesError.message,
      });
      setLoading(false);
      return;
    }

    // Fetch all admin roles
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      toast({
        variant: "destructive",
        title: "Failed to fetch roles",
        description: rolesError.message,
      });
      setLoading(false);
      return;
    }

    const adminUserIds = new Set(adminRoles?.map(role => role.user_id) || []);
    
    const usersWithRoles = profiles?.map(profile => ({
      ...profile,
      isAdmin: adminUserIds.has(profile.id)
    })) || [];

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      // Remove admin role
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        toast({
          variant: "destructive",
          title: "Failed to remove admin",
          description: error.message,
        });
      } else {
        toast({
          title: "Admin removed",
          description: "User has been demoted to regular user",
        });
        fetchUsers();
      }
    } else {
      // Add admin role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (error) {
        toast({
          variant: "destructive",
          title: "Failed to add admin",
          description: error.message,
        });
      } else {
        toast({
          title: "Admin added",
          description: "User has been promoted to admin",
        });
        fetchUsers();
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Role Management</CardTitle>
        <CardDescription>Promote or demote users to admin role</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline">{user.blood_group}</Badge>
                </TableCell>
                <TableCell>{user.district}</TableCell>
                <TableCell>
                  {user.isAdmin ? (
                    <Badge className="bg-primary text-primary-foreground">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary">User</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={user.isAdmin ? "destructive" : "default"}
                    onClick={() => toggleAdmin(user.id, user.isAdmin)}
                  >
                    {user.isAdmin ? (
                      <>
                        <ShieldOff className="h-3 w-3 mr-1" />
                        Remove Admin
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3 mr-1" />
                        Make Admin
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
